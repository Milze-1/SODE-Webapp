import sharp from 'sharp';
sharp('public/sode-logo.png')
  .resize(32, 32)
  .toFormat('png')
  .toFile('public/favicon-32.png')
  .then(() => console.log('Done: public/favicon-32.png'));
