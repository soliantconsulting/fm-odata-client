module.exports = {
    branches: [
        'main',
    ],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        '@semantic-release/changelog',
        'semantic-release-license',
        '@semantic-release/npm',
        '@semantic-release/github',
        [
            '@semantic-release/git',
            {
                assets: ['CHANGELOG.md', 'LICENSE', 'package.json', 'package-lock.json', 'npm-shrinkwrap.json'],
                message: 'chore(release): set `package.json` to ${nextRelease.version} [skip ci]'
                    + '\n\n${nextRelease.notes}',
            },
        ],
    ],
};
