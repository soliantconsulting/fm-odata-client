module.exports = {
    root: true,
    env: {
        node: true,
    },
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'prefer-arrow', 'import'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
    ],
    rules: {
        'indent': ['error', 4, {SwitchCase: 1}],
        'operator-linebreak': ['error', 'before'],
        'yoda': ['error', 'never'],
        'object-curly-spacing': ['error', 'never'],
        'array-bracket-spacing': ['error', 'never'],
        'space-in-parens': ['error', 'never'],
        'computed-property-spacing': ['error', 'never'],
        '@typescript-eslint/array-type': [
            'error',
            {default: 'array-simple', readonly: 'array-simple'},
        ],
        '@typescript-eslint/type-annotation-spacing': [
            'error',
            {before: true, after: true},
        ],
        '@typescript-eslint/ban-ts-comment': ['error', {
            'ts-ignore': 'allow-with-description',
        }],
        'prefer-arrow/prefer-arrow-functions': [
            'error',
            {
                disallowPrototype: true,
                singleReturnOnly: false,
                classPropertiesAllowed: false,
            },
        ],
        'import/no-unresolved': ['error', {commonjs: true, amd: true}],
        'import/newline-after-import': ['error'],
        'import/order': ['error', {
            'newlines-between': 'never',
            'alphabetize': {order: 'asc', caseInsensitive: true},
            'groups': [
                ['builtin', 'external'],
                'parent',
                'sibling',
                'index',
            ],
        }],
    },
};
