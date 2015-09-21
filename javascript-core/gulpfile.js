var spawn = require('child_process').spawn;
var gulp = require('gulp');

gulp.task('default', function() {

});

gulp.task('wds', function(callback) {
  spawn('npm', ['run', 'webpack-dev-server'], {
    stdio: 'inherit'
  });
});

gulp.task('c9', function(callback) {
  spawn('node', ['c9-server.js'], {
    stdio: 'inherit'
  });
});