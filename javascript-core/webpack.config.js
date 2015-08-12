module.exports = {
  entry: './src/index.js',
  output: {
    path: './resources',
    filename: 'bundle.js'
  },
  module: {
    preLoaders: [
      {
        test: /\.js$/,
        loader: 'eslint'
      }
    ],
    loaders: [
      {
        test: /.js$/,
        loader: 'babel-loader'
      }
    ]
  }
};