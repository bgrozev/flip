module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended",
        "@jitsi/eslint-config"
    ],
    "overrides": [
    ],
    "parser": "@babel/eslint-parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module",
        "requireConfigFile": false,
        "ecmaFeatures": {
            "jsx": true
        },
        "babelOptions": {
            "presets": ["@babel/preset-react"]
        }
    },
    "plugins": [
        "react"
    ],
    "rules": {
        "require-jsdoc": 0,
        "max-params": 0,
        "react/prop-types": 0,
        "object-property-newline": 0
    },
    "settings": {
        "react": {
            "version": "detect"
        }
    }
}
