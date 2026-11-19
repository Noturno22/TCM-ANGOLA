/**
 * i18n mobile — 14 idiomas, dicionários partilhados com a web via @tira/i18n.
 * Interpolação: t('game.match', { n: 5 }) → "Partida #5".
 */
export {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  isLanguage,
  setLanguage,
  getLanguage,
  t,
  type Language,
  type I18nKey,
  type I18nVars,
  type Dict,
} from '@tira/i18n';
