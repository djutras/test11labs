// lib/variable-replacer.ts
// Utility to replace {{variable}} placeholders with actual contact data

export interface ContactData {
  name?: string
  phone?: string
}

/**
 * Replace {{variable}} placeholders in a message with actual contact data
 * Supported variables: {{name}}, {{phone}}
 *
 * @param message - The message template with {{variable}} placeholders
 * @param contact - The contact data to use for replacement
 * @returns The message with variables replaced
 */
export function replaceVariables(message: string | undefined | null, contact: ContactData): string {
  if (!message) return ''

  let result = message

  // Replace {{name}} - use empty string if not provided
  result = result.replace(/\{\{name\}\}/gi, contact.name || '')

  // Replace {{phone}} - use empty string if not provided
  result = result.replace(/\{\{phone\}\}/gi, contact.phone || '')

  return result.trim()
}

/**
 * Get the list of supported variables for display in the UI
 */
export function getSupportedVariables(): { variable: string; description: string }[] {
  return [
    { variable: '{{name}}', description: "Contact's name from CSV" },
    { variable: '{{phone}}', description: "Contact's phone number" }
  ]
}

/**
 * Default first message template with variables
 */
export const DEFAULT_FIRST_MESSAGE = "Bonjour {{name}}! Ici Nicolas de Compta I A. Comment puis-je vous aider aujourd'hui?"

/**
 * Default full prompt template with variables
 */
export const DEFAULT_FULL_PROMPT = `Tu es Nicolas, assistant virtuel de Compta I A.
Tu fais un appel sortant pour contacter {{name}}.

REGLES:
- Sois professionnel et chaleureux
- Reponds en francais quebecois naturel
- Si question complexe, propose de transferer a un comptable
- Ne fais jamais de promesses sur des delais ou des prix
- Note les informations importantes pour le suivi`
