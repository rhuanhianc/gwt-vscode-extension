const path = require('path');

module.exports = {
  target: 'node', // VS Code extensions rodam em um ambiente Node.js
  mode: 'none', // será substituído pela linha de comando (production/development)
  
  entry: './src/extension.ts', // Ponto de entrada da sua extensão
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  
  devtool: 'source-map',
  
  externals: {
    vscode: 'commonjs vscode' // O módulo vscode deve ser externo
  },
  
  resolve: {
    extensions: ['.ts', '.js'] // Resolve ambos arquivos .ts e .js
  },
  
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              // Use as configurações do tsconfig.json
              compilerOptions: {
                "module": "commonjs",
              }
            }
          }
        ]
      }
    ]
  }
};