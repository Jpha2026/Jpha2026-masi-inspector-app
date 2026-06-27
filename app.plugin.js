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
      // Hashes computed 2026-06-25 from Let's Encrypt DER/PEM files (not live TLS):
      //   curl https://letsencrypt.org/certs/isrgrootx1.der | openssl x509 -inform der -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64
      //   curl https://letsencrypt.org/certs/isrg-root-x2.pem | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64
      fs.writeFileSync(
        path.join(xmlDir, "network_security_config.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
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
