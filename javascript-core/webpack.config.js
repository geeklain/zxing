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
    colors: true,
    contentBase: "./resources",
    //hot: true, //only works as a CLI param !?
    port: 8181,
    progress: true
    //inline: true //only works as a CLI param !?
  }
};