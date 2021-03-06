import {promises as fs} from 'fs';
import {File} from '../../models/file';
import {Movie} from '../../models/movie';
import {Episode} from '../../models/episode';
import logger from '../../submodules/logger';

export default class FileCleaner{
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async removedDeletedFiled () {
        let files = await File.findAll();

        for (let file of files) {
            try {
                await fs.stat(file.path);
            } catch (e) {
                logger.log('INFO', file.path, 'not found. Removing from database');

                await file.destroy();
            }
        }

    }

    async removeAssoclessFiles () {
        let results = await File.findAll({
            include: [Movie, Episode]
        });

        results.forEach((item) => {
            if (item.Movies.length === 0 && item.Episodes.length === 0) {
                item.destroy();
            }
        });
    }
}
