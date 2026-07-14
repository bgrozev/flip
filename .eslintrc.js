module.exports = {
    "root": true,
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended",
        "@jitsi/eslint-config"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module",
        "ecmaFeatures": {
            "jsx": true
        }
    },
    "plugins": [
        "react",
        "react-hooks",
        "@typescript-eslint"
    ],
    "overrides": [
        {
            "files": ["*.ts", "*.tsx"],
            "extends": [
                "plugin:@typescript-eslint/eslint-recommended",
                "plugin:@typescript-eslint/recommended"
            ],
            "rules": {
                // Warn-only for now; tighten during Phase 1 refactors
                "@typescript-eslint/no-explicit-any": 1,
                "prefer-const": 1,
                "react-hooks/exhaustive-deps": 1
            }
        },
        {
            "files": ["*.test.ts", "*.test.tsx"],
            "env": {
                "node": true
            }
        }
    ],
    "rules": {
        "require-jsdoc": 0,
        "max-params": 0,
        "react/prop-types": 0,
        "object-property-newline": 0,

        // Match the existing 2-space code style instead of reformatting the
        // whole codebase (@jitsi config assumes 4-space).
        "indent": ["error", 2, { "SwitchCase": 1 }],

        // Stylistic rules from @jitsi/eslint-config that the existing code
        // doesn't follow; disabled to keep lint useful without a mass reformat.
        "array-bracket-spacing": 0,
        "padding-line-between-statements": 0,
        "no-multi-spaces": 0,
        "curly": 0,
        "max-len": 0,
        "lines-around-comment": 0,
        "no-extra-parens": 0,
        "import/order": 0,
        "operator-linebreak": 0,
        "brace-style": 0,
        "no-negated-condition": 0,
        "arrow-body-style": 0,
        "max-statements-per-line": 0,
        "sort-imports": 0,
        "key-spacing": 0,
        "comma-dangle": 0,
        "quotes": 0,
        "no-continue": 0,
        "no-confusing-arrow": 0,
        "newline-per-chained-call": 0,
        "no-mixed-operators": 0,
        "no-bitwise": 0,

        // Substantive rules the current code violates: warn for now, clean up
        // in Phase 1 refactors (auto-fixing e.g. eqeqeq can change behavior).
        "eqeqeq": 1,
        "no-eq-null": 1,
        "no-shadow": 1,
        "no-implicit-coercion": 1,
        "dot-notation": 1,
        "prefer-const": 1,
        "prefer-template": 1,
        "no-extra-boolean-cast": 1,
        "import/no-duplicates": 1,
        "@typescript-eslint/no-explicit-any": 1,
        "react-hooks/rules-of-hooks": 2,
        "react-hooks/exhaustive-deps": 1
    },
    "settings": {
        "react": {
            "version": "detect"
        }
    }
}
