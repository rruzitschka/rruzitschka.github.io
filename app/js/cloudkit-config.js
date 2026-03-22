// cloudkit-config.js — CloudKit initialisation
// Replace YOUR_CLOUDKIT_WEB_TOKEN after generating it in CloudKit Dashboard

const CLOUDKIT_CONFIG = {
  containerIdentifier: 'iCloud.com.robertr.ClimbingNotes',
  apiToken: 'YOUR_CLOUDKIT_WEB_TOKEN',
  environment: 'production'
};

CloudKit.configure({
  containers: [{
    containerIdentifier: CLOUDKIT_CONFIG.containerIdentifier,
    apiTokenAuth: {
      apiToken: CLOUDKIT_CONFIG.apiToken,
      persist: true   // keeps user signed in across page reloads
    },
    environment: CLOUDKIT_CONFIG.environment
  }]
});

const container = CloudKit.getDefaultContainer();
const database  = container.privateCloudDatabase;
