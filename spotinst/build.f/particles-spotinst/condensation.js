var git = require('gulp-git'),
gulp = require('gulp'),
vfs = require('vinyl-fs'),
zip = require('gulp-zip'),
exec = require('child_process').exec;

module.exports.initialize = function(cb) {
  var child = exec('npm install', function(error, stdout, stderr) {
    if (error) return cb(error);
  });

  vfs.src(['*.js', 'cloudformation.template.json', 'node_modules/**/*', 'config/*.json'],{cwd:'../..', base:'../..'})
  .pipe(zip('spotinst.zip'))
  .pipe(gulp.dest('./particles/assets'))
  .on('end', function(err, data) {
    vfs.src(['cloudformation/index_lambda_deployer.js', 'cloudformation/lambda_deployer.js', 'cloudformation/index_iam_federation.js', 'cloudformation/iam_federation.js'],{cwd:'../../..', base:'../../..'})
    .pipe(zip('cloudformation_builder.zip'))
    .pipe(gulp.dest('./particles/assets'))
    .on('end', function(err, data) {
      vfs.src(['spotinst-lambda.zip'],{cwd:'../../../../spotinst-lambda/dist', base:'../../../../spotinst-lambda/dist'})
      .pipe(gulp.dest('./particles/assets'))
      .on('end', cb);
    });
  });
};
