# Configuração necessária no app iOS consumidor

Este plugin (`LocationTrackingPlugin.swift`) exige as seguintes entradas no
`Info.plist` do app iOS que o consome (`ios/App/App/Info.plist`, criado
quando o Capacitor for inicializado — task 2.4):

```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>O Outlife usa sua localização em segundo plano para continuar registrando sua atividade (trilha, pedalada, caminhada) mesmo com a tela bloqueada ou o app em segundo plano.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>O Outlife usa sua localização para registrar sua atividade.</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

E a capability **Background Modes → Location updates** deve estar habilitada
no target do Xcode (`Signing & Capabilities`), correspondente à entrada
`UIBackgroundModes` acima (Requirements 2.1, 2.2, 2.3, 2.6).
