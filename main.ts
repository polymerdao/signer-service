const {KeyManagementServiceClient} = require('@google-cloud/kms');


if (require.main === module) {
  (async () => {
    const client = new KeyManagementServiceClient();
    const locationName = client.locationPath("polymer-testnet-376705", "global");

    async function listKeyRings() {
      const [keyRings] = await client.listKeyRings({
        parent: locationName,
      });

      for (const keyRing of keyRings) {
        console.log(keyRing.name);
      }

      return keyRings;
    }

    return listKeyRings();
  })();
}