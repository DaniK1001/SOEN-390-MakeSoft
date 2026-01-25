// app.config.js — expose REACT_NATIVE_PACKAGER_HOSTNAME (or EXPO_PUBLIC_PC_IP) to Expo runtime
module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      PC_IP: process.env.EXPO_PUBLIC_PC_IP || process.env.REACT_NATIVE_PACKAGER_HOSTNAME || null,
    },
  };
};
