/** @type {import('next').NextConfig} */
module.exports = {
    transpilePackages: ['@mdxeditor/editor', 'react-diff-view'],
    reactStrictMode: false,
    images: {
        domains: ['abbey-collections-images.s3.amazonaws.com', 'art-history-images.s3.amazonaws.com', 'media.discordapp.net']
    },
    webpack: (config) => {
      // this will override the experiments
      config.experiments = { ...config.experiments, topLevelAwait: true };
      // this will just update topLevelAwait property of config.experiments
      // config.experiments.topLevelAwait = true 
      return config;
    },
}
