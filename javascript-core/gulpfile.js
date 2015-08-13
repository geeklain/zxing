var child = require('child_process');
var spawn = child.spawn;
var gulp = require('gulp');
var gutil = require("gulp-util");
var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");
var webpackConfig = require("./webpack.config.js");

gulp.task('default', function() {

});

gulp.task("wds", function(callback) {
  spawn('npm', ['run', 'webpack-dev-server'], {
    stdio: 'inherit'
  });
});