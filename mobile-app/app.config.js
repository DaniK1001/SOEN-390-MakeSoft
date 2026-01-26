// app.config.js — expose REACT_NATIVE_PACKAGER_HOSTNAME (or EXPO_PUBLIC_PC_IP) to Expo runtime
module.exports = ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: "AIzaSyBUU2yHJ8Fzw-4z7h7ueZuXIr4UXyZOMVY",
        },
      },
    },

    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: "AIzaSyBgq86SSQVcPItTBDY8YYbiEMSgMI3aM6c",
      },
    },

    extra: {
      PC_IP: process.env.EXPO_PUBLIC_PC_IP || process.env.REACT_NATIVE_PACKAGER_HOSTNAME || null,
    },
  };
};
