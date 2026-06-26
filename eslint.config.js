import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      '**/.*/**', // agent/editor tooling dirs (.claude, .cursor, .agents, .codex, …)
      'test-results',
      'public',
      'supabase/functions/**', // Deno runtime, separate type environment
      'src/app/components/ui/**', // vendored shadcn primitives
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Derived-state syncing in effects is widespread and working; surface as
      // warnings to burn down rather than blocking CI.
      'react-hooks/set-state-in-effect': 'warn',
      // React-compiler advisories that flag working patterns (selecting an icon
      // component per-render, referencing a useCallback before its declaration in
      // an effect that only runs after mount). Not runtime bugs — warn, don't block.
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
      // jsx-a11y can't see through Radix `asChild`/`Slot` or recognize a Radix
      // Switch as a labelable control, so nested-control labels read as false
      // positives. Keep as a warning so genuine cases still surface.
      'jsx-a11y/label-has-associated-control': 'warn',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
