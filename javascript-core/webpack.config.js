module.exports = {
  entry: [
    './src/index.js'
  ],
  output: {
    path: './resources',
    publicPath: '/',
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
        exclude: /node_modules/,
        loader: 'babel?'
                + 'optional[]=runtime'
                + '&cacheDirectory=true'
      }
    ]
  },
  devtool: 'source-map',
  devServer: {
    contentBase: './resources',
    port: 8181
  }
};