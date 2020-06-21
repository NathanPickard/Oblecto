import path from 'path';
import fs from 'fs';
import errors from 'restify-errors';

import jimp from 'jimp';

import databases from '../../../submodules/database';
import authMiddleWare from '../middleware/auth';
import sequelize from 'sequelize';

const Op = sequelize.Op;

export default (server, oblecto) => {

    // Endpoint to get a list of episodes from all series
    server.get('/movies/list/:sorting/:order', authMiddleWare.requiresAuth, async function (req, res) {
        let results = await databases.movie.findAll({
            include: [
                {
                    model: databases.trackMovies,
                    required: false,
                    where: {
                        userId: req.authorization.jwt.id
                    }
                }
            ],
            order: [
                [req.params.sorting, req.params.order]
            ],
            limit: 100
        });

        res.send(results);
    });

    server.get('/movies/sets', authMiddleWare.requiresAuth, async function (req, res) {
        let results = await databases.movieSet.findAll({
            include: [
                {
                    model: databases.movie,
                    include: [
                        {
                            model: databases.trackMovies,
                            required: false,
                            where: {
                                userId: req.authorization.jwt.id
                            }
                        }
                    ]
                }
            ],
            limit: 100
        });

        res.send(results);
    });



    // Endpoint to get a poster based on localId
    server.get('/movie/:id/poster', async function (req, res, next) {
        // Get episode data
        let movie = await databases.movie.findByPk(req.params.id, {
            include: [databases.file]
        });

        let posterPath = oblecto.artworkUtils.moviePosterPath(movie, 'large');

        // Check if the thumbnail exists
        fs.exists(posterPath, function (exists) {
            if (!exists)
                return next(new errors.NotFoundError('Poster for movie does not exist'));

            // If the thumbnail exists, simply pipe that to the client
            fs.createReadStream(posterPath).pipe(res);

        });

    });

    server.put('/movie/:id/poster', async function (req, res, next) {
        let movie = await databases.movie.findByPk(req.params.id, {
            include: [databases.file]
        });

        if (!movie) {
            return next(new errors.NotFoundError('Movie does not exist'));
        }

        let posterPath = path.normalize(oblecto.config.assets.moviePosterLocation) + '/' + movie.id + '.jpg';

        if (oblecto.config.assets.storeWithFile) {
            if (!movie.files[0])
                return next(new errors.NotFoundError('No file linked to movie'));

            let moviePath = movie.files[0].path;

            // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
            posterPath = moviePath.replace(path.extname(moviePath), '-poster.jpg');
        }

        if (req.files.length < 1) {
            return next(new errors.MissingParameter('Image file is missing'));
        }

        let uploadPath = req.files[Object.keys(req.files)[0]].path;

        try {
            let image = await jimp.read(uploadPath);

            let ratio = image.bitmap.height / image.bitmap.width;

            if ( !(1 <= ratio <= 2)) {
                return next(new errors.InvalidContent('Image aspect ratio is incorrect'));
            }

        } catch (e) {
            return next(new errors.InvalidContent('File is not an image'));
        }

        try {
            fs.copyFile(uploadPath, posterPath, (err) => {
                if (err) throw err;

                res.send(['success']);
            });
        } catch (e) {
            console.log(e);

            return next(new errors.Internal('An error has occured during upload of poster'));
        }

        next();
    });

    // Endpoint to get a fanart based on localId
    server.get('/movie/:id/fanart', async function (req, res, next) {
        // Get episode data
        let movie = await databases.movie.findByPk(req.params.id, {
            include: [databases.file]
        });

        let fanartPath = oblecto.artworkUtils.movieFanartPath(movie, 'large');

        // Check if the thumbnail exists
        fs.exists(fanartPath, function (exists) {
            if (exists) {
                // If the thumbnail exists, simply pipe that to the client
                fs.createReadStream(fanartPath).pipe(res);
            }
        });

    });

    server.put('/movie/:id/fanart', async function (req, res, next) {
        let movie = await databases.movie.findByPk(req.params.id, {
            include: [databases.file]
        });

        if (!movie) {
            return next(new errors.NotFoundError('Movie does not exist'));
        }

        let fanartPath = path.normalize(oblecto.config.assets.movieFanartLocation) + '/' + movie.id + '.jpg';

        if (oblecto.config.assets.storeWithFile) {
            if (!movie.files[0])
                return next(new errors.NotFoundError('No file linked to movie'));

            let moviePath = movie.files[0].path;

            // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
            fanartPath = moviePath.replace(path.extname(moviePath), '-fanart.jpg');
        }

        if (req.files.length < 1) {
            return next(new errors.MissingParameter('Image file is missing'));
        }

        let uploadPath = req.files[Object.keys(req.files)[0]].path

        try {
            let image = await jimp.read(uploadPath);

            let ratio = image.bitmap.width / image.bitmap.height

            if ( !(1 <= ratio <= 2)) {
                return next(new errors.InvalidContent('Image aspect ratio is incorrect'));
            }

        } catch (e) {
            return next(new errors.InvalidContent('File is not an image'));
        }

        try {
            fs.copyFile(uploadPath, fanartPath, (err) => {
                if (err) throw err;

                res.send(['success']);
            });
        } catch (e) {
            console.log(e);

            return next(new errors.Internal('An error has occured during upload of fanart'));
        }

        next();
    });

    // Endpoint to retrieve episode details based on the local movie ID
    server.get('/movie/:id/info', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let movie = await databases.movie.findByPk(req.params.id, {
            include: [
                databases.file,
                {
                    model: databases.trackMovies,
                    required: false,
                    where: {
                        userId: req.authorization.jwt.id
                    }
                }
            ]
        });

        res.send(movie);

    });

    // Endpoint to send episode video file to the client
    // TODO: move this to the file route and use file id to play, abstracting this from episodes
    server.get('/movie/:id/play', async function (req, res, next) {
        // search for attributes
        let movie = await databases.movie.findByPk(req.params.id, {
            include: [
                {
                    model: databases.file,
                    where: {
                        [Op.not]: {
                            extension: 'iso'
                        }
                    }
                }
            ]
        });

        let file = movie.files[0];

        res.redirect(`/stream/${file.id}`, next);
    });

    server.get('/movie/:id/sets', authMiddleWare.requiresAuth, async function (req, res, next) {
        let sets = await databases.movie.findByPk(req.params.id, {
            attributes: [],
            include: [
                {
                    model: databases.movieSet,
                    include: [
                        {
                            model: databases.movie,
                            include: [
                                {
                                    model: databases.trackMovies,
                                    required: false,
                                    where: {
                                        userId: req.authorization.jwt.id
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        res.send(sets.movieSets);
    });

    // Add movie to set with id
    server.put('/movie/:id/sets', authMiddleWare.requiresAuth, async function (req, res, next) {
        try {
            let [movie] = await databases.movie.findByPk(req.params.id);
            let [set] = await databases.movieSet.findByPk(req.params.setId);

            set.addMovie(movie);
        } catch (e) {
            return next(new errors.NotFoundError('Movie or set could not be found'));
        }
    });

    // Endpoint for text based searching of the movie database
    server.get('/movies/search/:name', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let movie = await databases.movie.findAll({
            where: {
                movieName: {
                    [Op.like]: '%' + req.params.name + '%'
                }
            },
            include: [databases.file]
        });

        res.send(movie);

    });

    // Endpoint to get the episodes currently being watched
    server.get('/movies/watching', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let tracks = await databases.trackMovies.findAll({
            include: [{
                model: databases.movie,
                required: true,
                include: [
                    {
                        model: databases.trackMovies,
                        required: false,
                        where: {
                            userId: req.authorization.jwt.id
                        }
                    }
                ]
            }],
            where: {
                userId: req.authorization.jwt.id,
                progress: {
                    [sequelize.Op.lt]: 0.9
                },
                updatedAt: {
                    [sequelize.Op.gt]: new Date() - (1000*60*60*24*7)
                }
            },
            order: [
                ['updatedAt', 'DESC'],
            ],
        });

        // We are only interested in the episode objects, so extract all the episode object from
        // each track object and send the final mapped array to the client
        res.send(tracks.map((track) => {
            return track.movie;
        }));
    });

};
