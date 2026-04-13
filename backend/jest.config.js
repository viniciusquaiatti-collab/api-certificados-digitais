module.exports = {
  testEnvironment: 'node', // Ambiente de teste: Node.js
  collectCoverageFrom: [
    'src/**/*.js', // Arquivos para cobertura
    '!src/**/*.test.js', // Exclui arquivos de teste
  ],
  testMatch: ['**/__tests__/**/*.test.js'], // Onde os testes estão
  verbose: true, // Mostra os logs dos testes no terminal
};