export interface GwtProjectInfo {
    pomPath: string;         // caminho completo do pom.xml
    pluginVersion: string;   // versão do plugin gwt-maven-plugin (se encontrada)
    moduleName?: string;     // <moduleName> 
    devModePort?: number;    // extraído de <devmodeArgs>
    codeServerPort?: number; // extraído de <codeserverArgs>
  }
  