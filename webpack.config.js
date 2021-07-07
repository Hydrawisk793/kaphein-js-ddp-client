const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const { WebpackBabelHelpersEs3Plugin } = require("webpack-babel-helpers-es3-plugin");
const nodeExternals = require("webpack-node-externals");

module.exports = function (env, argv)
{
    const cwd = process.cwd();
    const rootDir = __dirname;
    const ecmaVersion = 3;
    const srcDir = path.resolve(rootDir, "src");
    const libraryName = "kaphein-js-ddp-client";
    const outputLibraryType = "umd";
    const outputPath = (argv.outputPath || path.resolve(cwd, "dist"));
    const nodeModulesPath = path.resolve(rootDir, "node_modules");

    const babelConfig = {
        assumptions : {
            constantSuper : true,
            noClassCalls : true,
            setClassMethods : true,
            superIsCallableConstructor : true,
            setPublicClassFields : true,
            privateFieldsAsProperties : false
        },
        presets : [
            [
                "@babel/preset-env",
                {
                    useBuiltIns : false,
                    loose : true,
                    forceAllTransforms : true
                }
            ]
        ],
        plugins : [
            "@babel/plugin-transform-runtime"
        ],
        sourceType : "unambiguous",
        targets : {
            "ie" : "5"
        }
    };

    return {
        mode : argv.mode,
        entry : path.resolve(srcDir, "index.js"),
        // devtool : false,
        target : "es" + ecmaVersion,
        output : {
            filename : "index.js",
            path : outputPath,
            library : {
                name : libraryName,
                type : outputLibraryType,
                umdNamedDefine : true
            },
            globalObject : "this"
        },
        optimization : {
            minimizer : [
                new TerserPlugin({
                    terserOptions : {
                        compress : false,
                        ecma : ecmaVersion,
                        ie8 : true,
                        safari10 : true,
                        mangle : false,
                    }
                })
            ]
            // minimize : false,
        },
        externals : [
            nodeExternals({
                importType : outputLibraryType
            })
        ],
        resolve : {
            modules : [nodeModulesPath]
        },
        module : {
            rules : [
                {
                    test : /\.m?js$/,
                    exclude : nodeModulesPath,
                    loader : "babel-loader",
                    options : babelConfig
                }
            ]
        },
        plugins : [
            new WebpackBabelHelpersEs3Plugin(),
            new CopyWebpackPlugin({
                patterns : [
                    {
                        context : "src",
                        from : "**/*.d.ts",
                        to : ""
                    }
                ]
            }),
        ]
    };
};
