const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withNetworkSecurityManifest(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    return config;
  });
}

function withNetworkSecurityXml(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml"
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, "network_security_config.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="false">app.masi.com.mx</domain>
    <pin-set expiration="2030-01-01">
      <!-- ISRG Root X1 — Let's Encrypt primary root CA (valid until 2035) -->
      <pin digest="SHA-256">C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=</pin>
      <!-- ISRG Root X2 — Let's Encrypt backup root CA -->
      <pin digest="SHA-256">+QHt0j1IgBr88CsiSG197KRsbAlprQDohcvoe1Za45Y=</pin>
    </pin-set>
  </domain-config>
</network-security-config>`
      );
      return config;
    },
  ]);
}

module.exports = function withNetworkSecurity(config) {
  config = withNetworkSecurityManifest(config);
  config = withNetworkSecurityXml(config);
  return config;
};
