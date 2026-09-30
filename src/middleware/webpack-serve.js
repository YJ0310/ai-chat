import fs from 'node:fs';
import path from 'node:path';
import webpack from 'webpack';
import getPublicLibConfig from '../../webpack.config.js';

export default function getWebpackServeMiddleware() {
    /**
     * A very spartan recreation of webpack-dev-middleware.
     * @param {import('express').Request} req Request object.
     * @param {import('express').Response} res Response object.
     * @param {import('express').NextFunction} next Next function.
     * @type {import('express').RequestHandler}
     */
    function devMiddleware(req, res, next) {
        const parsedPath = path.parse(req.path);

        if (req.method === 'GET' && parsedPath.dir === '/' && (parsedPath.base === 'lib.js' || parsedPath.base === 'lib.js.map')) {
            const distWebpack = path.resolve(process.cwd(), 'dist', '_webpack');
            if (fs.existsSync(distWebpack)) {
                try {
                    const entries = fs.readdirSync(distWebpack, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isDirectory()) {
                            const candidateDir = path.join(distWebpack, entry.name, 'output');
                            const candidateFile = path.join(candidateDir, parsedPath.base);
                            if (fs.existsSync(candidateFile)) {
                                return res.sendFile(parsedPath.base, { root: candidateDir });
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to read dist/_webpack:', e);
                }
            }

            try {
                const publicLibConfig = getPublicLibConfig();
                const outputPath = publicLibConfig.output?.path;
                const outputFile = publicLibConfig.output?.filename || 'lib.js';

                if (outputPath && parsedPath.base === outputFile && fs.existsSync(path.join(outputPath, outputFile))) {
                    return res.sendFile(outputFile, { root: outputPath });
                }
            } catch (e) {
                console.error('Failed to get public lib config:', e);
            }
        }

        next();
    }

    /**
     * Wait until Webpack is done compiling.
     * @param {object} param Parameters.
     * @param {boolean} [param.forceDist=false] Whether to force the use the /dist folder.
     * @param {boolean} [param.pruneCache=false] Whether to prune old cache directories before compiling.
     * @returns {Promise<void>}
     */
    devMiddleware.runWebpackCompiler = ({ forceDist = false, pruneCache = false } = {}) => {
        if (process.env.NODE_ENV === 'production' && !forceDist) {
            console.log('Production runtime: skipping Webpack compiler to prevent OOM.');
            return Promise.resolve();
        }

        const publicLibConfig = getPublicLibConfig({ forceDist, pruneCache });
        const outputPath = publicLibConfig.output?.path;
        const outputFile = publicLibConfig.output?.filename || 'lib.js';
        const targetFile = outputPath ? path.join(outputPath, outputFile) : null;

        if (targetFile && fs.existsSync(targetFile)) {
            console.log(`Frontend libraries bundle already exists at ${targetFile}. Skipping compilation.`);
            return Promise.resolve();
        }

        console.log();
        console.log('Compiling frontend libraries...');

        const compiler = webpack(publicLibConfig);

        return new Promise((resolve) => {
            compiler.run((_error, stats) => {
                const output = stats?.toString(publicLibConfig.stats);
                if (output) {
                    console.log(output);
                    console.log();
                }
                compiler.close(() => {
                    resolve();
                });
            });
        });
    };

    return devMiddleware;
}
