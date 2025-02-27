# GWT Essentials (Multi-Module)


Extensão VS Code para desenvolvimento com GWT (Google Web Toolkit) em projetos multi-módulo Maven.

## Funcionalidades Principais

- 🕵️ Varredura automática de projetos GWT através de arquivos `pom.xml`
- 🎮 Controle completo dos processos GWT:
  - ▶️/⏹️ Compilação GWT
  - ▶️/⏹️ GWT DevMode
  - ▶️/⏹️ GWT CodeServer
  - ▶️/⏹️ Servidor Jetty
- 🛠️ Interface gráfica dedicada na Activity Bar
- 📝 Logs coloridos e dedicados para cada processo
- ⚙️ Configuração personalizável de paths e comandos
- 🔍 Suporte a projetos multi-módulo Maven
- 🚨 Parada simultânea de todos os processos

## Instalação

1. Abra o VS Code
2. Vá para a aba Extensions (Ctrl+Shift+X)
3. Pesquise por "GWT Essentials (Multi-Module)"
4. Clique em Install

**Pré-requisitos:**
- Java JDK (8+ recomendado)
- Apache Maven configurado no PATH
- Projeto GWT com configuração Maven

## Utilização

### Painel de Controle GWT
1. Abra o painel GWT na Activity Bar (ícone do GWT)
2. Use os botões para:
   - 🔄 Atualizar lista de projetos
   - ⚡ Iniciar/Parar processos
   - 📤 Acessar logs
   - ⚙️ Abrir configurações

### Comandos Disponíveis (Ctrl+Shift+P)
| Comando                | Descrição                          |
|------------------------|-----------------------------------|
| GWT: Refresh Projects  | Redetecta projetos no workspace   |
| GWT: Run Compile       | Inicia compilação GWT             |
| GWT: Stop Compile      | Para compilação em execução       |
| GWT: Run DevMode       | Inicia o GWT DevMode              |
| GWT: Stop DevMode      | Para o DevMode em execução        |
| GWT: Run CodeServer    | Inicia o GWT CodeServer           |
| GWT: Stop CodeServer   | Para o CodeServer em execução     |
| GWT: Start Jetty       | Inicia servidor Jetty             |
| GWT: Stop Jetty        | Para servidor Jetty               |
| GWT: Stop All          | Para todos os processos GWT       |
| GWT: Show Logs         | Exibe painel de logs              |
| GWT: Open Settings     | Abre configurações da extensão    |

## Configuração

Acesse as configurações (`File > Preferences > Settings` ou Ctrl+,) e procure por "GWT":

| Configuração                  | Descrição                                | Padrão           |
|-------------------------------|----------------------------------------|------------------|
| `gwtHelper.javaPath`          | Caminho completo do Java               | `java`           |
| `gwtHelper.mavenCommand`      | Comando Maven customizado              | `mvn`            |
| `gwtHelper.devModeGoals`      | Goals Maven para DevMode               | `gwt:devmode`    |
| `gwtHelper.codeServerGoals`   | Goals Maven para CodeServer            | `gwt:codeserver` |
| `gwtHelper.jettyGoals`        | Goals Maven para Jetty                 | `jetty:run`      |
| `gwtHelper.compileGoals`      | Goals Maven para compilação            | `gwt:compile`    |

**Exemplo de configuração para Windows:**
```json
"gwtHelper.javaPath": "C:/Program Files/Java/jdk1.8.0_301",
"gwtHelper.mavenCommand": "mvn.cmd"
```

## Troubleshooting

### Problemas Comuns
1. **Processos não iniciam:**
   - Verifique o path do Java nas configurações
   - Confira se o Maven está instalado e no PATH
   - Consulte os logs (`GWT: Show Logs`)

2. **Erros de porta:**
   - Verifique as portas configuradas no `pom.xml`
   ```xml
   <devmodeArgs>
     <arg>-port</arg>
     <arg>8888</arg>
   </devmodeArgs>
   ```

3. **Projetos não detectados:**
   - Certifique-se que o `pom.xml` contém o plugin GWT:
   ```xml
   <artifactId>gwt-maven-plugin</artifactId>
   ```

## Desenvolvimento

Contribuições são bem-vindas! Siga os passos:

1. Faça fork do repositório
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Modifique o código em TypeScript
4. Compile com:
   ```bash
   npm run compile
   ```
5. Instale o vspkg:
   ```bash
   npm install -g vsce
   ```
6. Empacote a extensão:
   ```bash
    vsce package
    ```
## Licença

Este projeto está licenciado sob a MIT License.

---

**Nota:** Esta extensão não é oficialmente associada ao Google ou ao projeto GWT.

**Observação:** Este projeto é um exemplo de extensão para GWT e pode ser adaptado conforme as necessidades do desenvolvimento.
```

