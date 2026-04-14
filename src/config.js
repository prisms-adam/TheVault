const prisma = require('./db');
const path = require('path');

const getSetting = async (key, defaultValue) => {
  try {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting ? setting.value : defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

const getUploadDir = async () => {
  return await getSetting('upload_directory', 'uploads');
};

module.exports = { getSetting, getUploadDir };
