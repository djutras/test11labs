// lib/translations.ts
// Translation utility for English/French language support

export type Language = 'en' | 'fr'

export const translations = {
  // Common
  loading: {
    en: 'Loading...',
    fr: 'Chargement...'
  },
  save: {
    en: 'Save',
    fr: 'Enregistrer'
  },
  cancel: {
    en: 'Cancel',
    fr: 'Annuler'
  },
  delete: {
    en: 'Delete',
    fr: 'Supprimer'
  },
  edit: {
    en: 'Edit',
    fr: 'Modifier'
  },
  close: {
    en: 'Close',
    fr: 'Fermer'
  },
  saving: {
    en: 'Saving...',
    fr: 'Enregistrement...'
  },
  creating: {
    en: 'Creating...',
    fr: 'Création...'
  },

  // Navigation
  backToHome: {
    en: 'Back to Home',
    fr: 'Retour à l\'accueil'
  },
  backToCampaigns: {
    en: 'Back to Campaigns',
    fr: 'Retour aux campagnes'
  },

  // Campaigns List Page
  campaignsTitle: {
    en: 'Campaigns',
    fr: 'Campagnes'
  },
  campaignsSubtitle: {
    en: 'Manage your call campaigns',
    fr: 'Gérez vos campagnes d\'appels'
  },
  createCampaign: {
    en: 'Create Campaign',
    fr: 'Créer une campagne'
  },
  newCampaign: {
    en: 'New Call',
    fr: 'Nouvel appel'
  },
  noCampaigns: {
    en: 'No campaigns yet',
    fr: 'Aucune campagne pour le moment'
  },
  noCampaignsDesc: {
    en: 'Create your first campaign to start making calls',
    fr: 'Créez votre première campagne pour commencer les appels'
  },
  scheduledCalls: {
    en: 'scheduled calls',
    fr: 'appels programmés'
  },
  viewCampaign: {
    en: 'View Campaign',
    fr: 'Voir la campagne'
  },

  // Campaign Status
  statusActive: {
    en: 'Active',
    fr: 'Active'
  },
  statusPaused: {
    en: 'Paused',
    fr: 'En pause'
  },
  statusCompleted: {
    en: 'Completed',
    fr: 'Terminée'
  },

  // Create Campaign Page
  createCampaignTitle: {
    en: 'Create Campaign',
    fr: 'Créer une campagne'
  },
  createCampaignSubtitle: {
    en: 'Set up a new call campaign',
    fr: 'Configurer une nouvelle campagne d\'appels'
  },
  phoneNumbersInfo: {
    en: 'Phone Numbers',
    fr: 'Numéros de téléphone'
  },
  inboundForwardTo: {
    en: 'Inbound calls forwarded to',
    fr: 'Appels entrants transférés au'
  },
  outboundCallsFrom: {
    en: 'Outbound calls from',
    fr: 'Appels sortants depuis'
  },
  campaignName: {
    en: 'Campaign Name',
    fr: 'Nom de la campagne'
  },
  campaignNamePlaceholder: {
    en: 'e.g., January Client Outreach',
    fr: 'ex: Relance clients janvier'
  },
  creatorEmail: {
    en: 'Creator Email',
    fr: 'Email du créateur'
  },
  creatorEmailDesc: {
    en: 'receives notifications',
    fr: 'reçoit les notifications'
  },

  // First Message & Full Prompt
  firstMessage: {
    en: 'First Message',
    fr: 'Premier message'
  },
  firstMessageDesc: {
    en: "Agent's greeting",
    fr: 'Message d\'accueil de l\'agent'
  },
  firstMessagePlaceholder: {
    en: 'The message the agent will say first...',
    fr: 'Le message que l\'agent dira en premier...'
  },
  fullPrompt: {
    en: 'Full Prompt',
    fr: 'Instructions complètes'
  },
  fullPromptDesc: {
    en: "Agent's system instructions",
    fr: 'Instructions système de l\'agent'
  },
  fullPromptPlaceholder: {
    en: 'The system prompt that defines how the agent behaves...',
    fr: 'Les instructions qui définissent le comportement de l\'agent...'
  },
  variables: {
    en: 'Variables',
    fr: 'Variables'
  },
  generateWithGemini: {
    en: 'Generate with Gemini',
    fr: 'Générer avec Gemini'
  },
  generating: {
    en: 'Generating...',
    fr: 'Génération...'
  },

  // Call Days
  callDays: {
    en: 'Call Days',
    fr: 'Jours d\'appel'
  },
  monday: {
    en: 'Monday',
    fr: 'Lundi'
  },
  tuesday: {
    en: 'Tuesday',
    fr: 'Mardi'
  },
  wednesday: {
    en: 'Wednesday',
    fr: 'Mercredi'
  },
  thursday: {
    en: 'Thursday',
    fr: 'Jeudi'
  },
  friday: {
    en: 'Friday',
    fr: 'Vendredi'
  },
  saturday: {
    en: 'Saturday',
    fr: 'Samedi'
  },
  sunday: {
    en: 'Sunday',
    fr: 'Dimanche'
  },

  // Call Hours
  startHour: {
    en: 'Start Hour',
    fr: 'Heure de début'
  },
  endHour: {
    en: 'End Hour',
    fr: 'Heure de fin'
  },
  timezone: {
    en: 'Timezone',
    fr: 'Fuseau horaire'
  },

  // Priority
  priority: {
    en: 'Priority',
    fr: 'Priorité'
  },
  priorityDesc: {
    en: 'Higher priority campaigns call first',
    fr: 'Les campagnes prioritaires appellent en premier'
  },

  // Voicemail
  voicemailAction: {
    en: 'Voicemail Action',
    fr: 'Action messagerie vocale'
  },
  voicemailHangup: {
    en: 'Hang up (schedule retry later)',
    fr: 'Raccrocher (réessayer plus tard)'
  },
  voicemailLeaveMessage: {
    en: 'Leave voicemail message',
    fr: 'Laisser un message vocal'
  },
  voicemailRetry: {
    en: 'Retry (max 2 voicemail retries)',
    fr: 'Réessayer (max 2 tentatives)'
  },
  voicemailMessage: {
    en: 'Voicemail Message',
    fr: 'Message vocal'
  },
  voicemailMessagePlaceholder: {
    en: 'Enter the message to leave on voicemail...',
    fr: 'Entrez le message à laisser sur la messagerie...'
  },

  // Recording Disclosure
  recordingDisclosure: {
    en: 'Recording Disclosure',
    fr: 'Avis d\'enregistrement'
  },
  recordingDisclosurePlaceholder: {
    en: 'This will be said at the beginning of each call...',
    fr: 'Ceci sera dit au début de chaque appel...'
  },
  recordingDisclosureDesc: {
    en: 'This message is prepended to the first message of each call',
    fr: 'Ce message est ajouté au début du premier message de chaque appel'
  },
  recordingDisclosureDefault: {
    en: 'This call may be recorded for quality purposes.',
    fr: 'Cet appel peut être enregistré à des fins de qualité.'
  },

  // Campaign Detail Page
  campaignDetails: {
    en: 'Campaign Details',
    fr: 'Détails de la campagne'
  },
  editCampaign: {
    en: 'Edit Campaign',
    fr: 'Modifier la campagne'
  },
  uploadCsv: {
    en: 'Upload CSV',
    fr: 'Importer CSV'
  },
  campaignSettings: {
    en: 'Campaign Settings',
    fr: 'Paramètres de la campagne'
  },

  // Scheduled Calls
  scheduledCallsTitle: {
    en: 'Scheduled Calls',
    fr: 'Appels programmés'
  },
  noScheduledCalls: {
    en: 'No scheduled calls yet',
    fr: 'Aucun appel programmé'
  },
  noScheduledCallsDesc: {
    en: 'Upload a CSV file to add contacts to this campaign',
    fr: 'Importez un fichier CSV pour ajouter des contacts à cette campagne'
  },
  phone: {
    en: 'Phone',
    fr: 'Téléphone'
  },
  name: {
    en: 'Name',
    fr: 'Nom'
  },
  status: {
    en: 'Status',
    fr: 'Statut'
  },
  scheduledFor: {
    en: 'Scheduled for',
    fr: 'Prévu pour'
  },
  callStatus: {
    en: 'Call Status',
    fr: 'Statut de l\'appel'
  },

  // Call Statuses
  callPending: {
    en: 'Pending',
    fr: 'En attente'
  },
  callInProgress: {
    en: 'In Progress',
    fr: 'En cours'
  },
  callCompleted: {
    en: 'Completed',
    fr: 'Terminé'
  },
  callFailed: {
    en: 'Failed',
    fr: 'Échoué'
  },
  callNoAnswer: {
    en: 'No Answer',
    fr: 'Sans réponse'
  },
  callVoicemail: {
    en: 'Voicemail',
    fr: 'Messagerie'
  },

  // CSV Upload
  csvUploadTitle: {
    en: 'Upload CSV',
    fr: 'Importer un CSV'
  },
  csvUploadDesc: {
    en: 'Upload a CSV file with contacts to add to this campaign',
    fr: 'Importez un fichier CSV avec les contacts à ajouter à cette campagne'
  },
  csvFormat: {
    en: 'CSV Format',
    fr: 'Format CSV'
  },
  csvFormatDesc: {
    en: 'phone (required), name (optional), subject (optional)',
    fr: 'phone (requis), name (optionnel), subject (optionnel)'
  },
  selectFile: {
    en: 'Select File',
    fr: 'Sélectionner un fichier'
  },
  uploadFile: {
    en: 'Upload',
    fr: 'Importer'
  },
  uploading: {
    en: 'Uploading...',
    fr: 'Importation...'
  },
  uploadSuccess: {
    en: 'Upload successful',
    fr: 'Importation réussie'
  },
  contactsAdded: {
    en: 'contacts added',
    fr: 'contacts ajoutés'
  },
  contactsSkipped: {
    en: 'contacts skipped',
    fr: 'contacts ignorés'
  },

  // Errors
  errorRequired: {
    en: 'This field is required',
    fr: 'Ce champ est requis'
  },
  errorCampaignName: {
    en: 'Campaign name is required',
    fr: 'Le nom de la campagne est requis'
  },
  errorCreatorEmail: {
    en: 'Creator email is required',
    fr: 'L\'email du créateur est requis'
  },
  errorCallDays: {
    en: 'Select at least one call day',
    fr: 'Sélectionnez au moins un jour d\'appel'
  },
  errorCallHours: {
    en: 'Start hour must be before end hour',
    fr: 'L\'heure de début doit être avant l\'heure de fin'
  },
  errorGeneric: {
    en: 'An error occurred',
    fr: 'Une erreur est survenue'
  },
  errorCreateCampaign: {
    en: 'Failed to create campaign',
    fr: 'Échec de la création de la campagne'
  },
  errorUpdateCampaign: {
    en: 'Failed to update campaign',
    fr: 'Échec de la mise à jour de la campagne'
  },
  errorLoadCampaign: {
    en: 'Failed to load campaign',
    fr: 'Échec du chargement de la campagne'
  },
  errorUploadCsv: {
    en: 'Failed to upload CSV',
    fr: 'Échec de l\'importation du CSV'
  },
  errorGenerateMessage: {
    en: 'Failed to generate message',
    fr: 'Échec de la génération du message'
  },

  // Language
  language: {
    en: 'Language',
    fr: 'Langue'
  },
  english: {
    en: 'English',
    fr: 'Anglais'
  },
  french: {
    en: 'French',
    fr: 'Français'
  },

  // Email Campaign Translations
  emailCampaign: {
    en: 'Email Campaign',
    fr: 'Campagne courriel'
  },
  newEmailCampaign: {
    en: 'New Email Campaign',
    fr: 'Nouvelle campagne courriel'
  },
  emailCampaignsTitle: {
    en: 'Email Campaigns',
    fr: 'Campagnes courriel'
  },
  emailCampaignsSubtitle: {
    en: 'Manage your email campaigns',
    fr: 'Gérez vos campagnes courriel'
  },
  emailSubject: {
    en: 'Email Subject',
    fr: 'Sujet du courriel'
  },
  emailSubjectPlaceholder: {
    en: 'Enter the email subject...',
    fr: 'Entrez le sujet du courriel...'
  },
  emailBody: {
    en: 'Email Body',
    fr: 'Corps du courriel'
  },
  emailBodyPlaceholder: {
    en: 'Enter the email content...',
    fr: 'Entrez le contenu du courriel...'
  },
  emailBodyDesc: {
    en: 'The content that will be sent to recipients',
    fr: 'Le contenu qui sera envoyé aux destinataires'
  },
  sendDays: {
    en: 'Send Days',
    fr: 'Jours d\'envoi'
  },
  sendStartHour: {
    en: 'Send Start Hour',
    fr: 'Heure de début d\'envoi'
  },
  sendEndHour: {
    en: 'Send End Hour',
    fr: 'Heure de fin d\'envoi'
  },
  campaignDuration: {
    en: 'Campaign Duration',
    fr: 'Durée de la campagne'
  },
  durationDays: {
    en: 'days',
    fr: 'jours'
  },
  durationWeeks: {
    en: 'weeks',
    fr: 'semaines'
  },
  schedulingDaily: {
    en: 'Daily',
    fr: 'Quotidien'
  },
  schedulingContinuous: {
    en: 'Continuous',
    fr: 'Continu'
  },
  schedulingWeekly: {
    en: 'Weekly',
    fr: 'Hebdomadaire'
  },

  // Email Status
  emailPending: {
    en: 'Pending',
    fr: 'En attente'
  },
  emailSent: {
    en: 'Sent',
    fr: 'Envoyé'
  },
  emailFailed: {
    en: 'Failed',
    fr: 'Échoué'
  },

  // Email Campaign Details
  scheduledEmails: {
    en: 'Scheduled Emails',
    fr: 'Courriels programmés'
  },
  noScheduledEmails: {
    en: 'No scheduled emails yet',
    fr: 'Aucun courriel programmé'
  },
  noScheduledEmailsDesc: {
    en: 'Upload a CSV file to add contacts to this campaign',
    fr: 'Importez un fichier CSV pour ajouter des contacts à cette campagne'
  },
  emailAddress: {
    en: 'Email Address',
    fr: 'Adresse courriel'
  },
  csvEmailFormat: {
    en: 'CSV Format',
    fr: 'Format CSV'
  },
  csvEmailFormatDesc: {
    en: 'email (required), name (optional), subject (optional)',
    fr: 'email (requis), name (optionnel), subject (optionnel)'
  },

  // Email Campaign Errors
  errorCreateEmailCampaign: {
    en: 'Failed to create email campaign',
    fr: 'Échec de la création de la campagne courriel'
  },
  errorUpdateEmailCampaign: {
    en: 'Failed to update email campaign',
    fr: 'Échec de la mise à jour de la campagne courriel'
  },
  errorLoadEmailCampaign: {
    en: 'Failed to load email campaign',
    fr: 'Échec du chargement de la campagne courriel'
  },
  errorGenerateEmail: {
    en: 'Failed to generate email content',
    fr: 'Échec de la génération du contenu courriel'
  },

  // Duration Options
  duration1Day: {
    en: '1 day',
    fr: '1 jour'
  },
  duration2Days: {
    en: '2 days',
    fr: '2 jours'
  },
  duration3Days: {
    en: '3 days',
    fr: '3 jours'
  },
  duration4Days: {
    en: '4 days',
    fr: '4 jours'
  },
  duration5Days: {
    en: '5 days',
    fr: '5 jours'
  },
  duration6Days: {
    en: '6 days',
    fr: '6 jours'
  },
  duration7Days: {
    en: '7 days',
    fr: '7 jours'
  },
  duration8Days: {
    en: '8 days',
    fr: '8 jours'
  },
  duration9Days: {
    en: '9 days',
    fr: '9 jours'
  },
  duration10Days: {
    en: '10 days',
    fr: '10 jours'
  },
  durationContinuous: {
    en: 'Continuous (every day)',
    fr: 'Continu (tous les jours)'
  },
  duration4Weeks: {
    en: '4 weeks',
    fr: '4 semaines'
  },
  duration12Weeks: {
    en: '12 weeks',
    fr: '12 semaines'
  },
  duration24Weeks: {
    en: '24 weeks',
    fr: '24 semaines'
  },
  duration48Weeks: {
    en: '48 weeks',
    fr: '48 semaines'
  },

  // Create Email Campaign
  createEmailCampaignTitle: {
    en: 'Create Email Campaign',
    fr: 'Créer une campagne courriel'
  },
  createEmailCampaignSubtitle: {
    en: 'Set up a new email campaign',
    fr: 'Configurer une nouvelle campagne courriel'
  },

  // SMS Campaign Translations
  smsCampaign: {
    en: 'SMS Campaign',
    fr: 'Campagne texto'
  },
  smsCampaigns: {
    en: 'SMS Campaigns',
    fr: 'Campagnes texto'
  },
  newSmsCampaign: {
    en: 'New SMS Campaign',
    fr: 'Nouvelle campagne texto'
  },
  smsCampaignsTitle: {
    en: 'SMS Campaigns',
    fr: 'Campagnes texto'
  },
  smsCampaignsSubtitle: {
    en: 'Manage your SMS campaigns',
    fr: 'Gérez vos campagnes texto'
  },
  smsMessage: {
    en: 'SMS Message',
    fr: 'Message SMS'
  },
  smsMessagePlaceholder: {
    en: 'Enter your SMS message (max 160 characters)...',
    fr: 'Entrez votre message SMS (max 160 caractères)...'
  },
  smsMessageDesc: {
    en: 'The message that will be sent to recipients (160 chars = 1 SMS)',
    fr: 'Le message qui sera envoyé aux destinataires (160 car. = 1 SMS)'
  },
  frequencyType: {
    en: 'Frequency Type',
    fr: 'Type de fréquence'
  },
  frequencyWeekly: {
    en: 'Weekly',
    fr: 'Hebdomadaire'
  },
  frequencyMonthly: {
    en: 'Monthly',
    fr: 'Mensuel'
  },
  frequencyValue: {
    en: 'Frequency',
    fr: 'Fréquence'
  },
  week: {
    en: 'week',
    fr: 'semaine'
  },
  weeks: {
    en: 'weeks',
    fr: 'semaines'
  },
  month: {
    en: 'month',
    fr: 'mois'
  },
  months: {
    en: 'months',
    fr: 'mois'
  },
  stopSms: {
    en: 'Stop',
    fr: 'Arrêter'
  },
  resumeSms: {
    en: 'Resume',
    fr: 'Repartir'
  },
  scheduledSms: {
    en: 'Scheduled SMS',
    fr: 'SMS programmés'
  },
  noScheduledSms: {
    en: 'No scheduled SMS yet',
    fr: 'Aucun SMS programmé'
  },
  noScheduledSmsDesc: {
    en: 'Upload a CSV file to add contacts to this campaign',
    fr: 'Importez un fichier CSV pour ajouter des contacts à cette campagne'
  },
  smsPending: {
    en: 'Pending',
    fr: 'En attente'
  },
  smsSent: {
    en: 'Sent',
    fr: 'Envoyé'
  },
  smsFailed: {
    en: 'Failed',
    fr: 'Échoué'
  },
  smsPaused: {
    en: 'Paused',
    fr: 'En pause'
  },
  csvSmsFormat: {
    en: 'CSV Format',
    fr: 'Format CSV'
  },
  csvSmsFormatDesc: {
    en: 'phone (required), name (optional)',
    fr: 'phone (requis), name (optionnel)'
  },
  createSmsCampaignTitle: {
    en: 'Create SMS Campaign',
    fr: 'Créer une campagne texto'
  },
  createSmsCampaignSubtitle: {
    en: 'Set up a new SMS campaign',
    fr: 'Configurer une nouvelle campagne texto'
  },
  errorCreateSmsCampaign: {
    en: 'Failed to create SMS campaign',
    fr: 'Échec de la création de la campagne texto'
  },
  errorUpdateSmsCampaign: {
    en: 'Failed to update SMS campaign',
    fr: 'Échec de la mise à jour de la campagne texto'
  },
  errorLoadSmsCampaign: {
    en: 'Failed to load SMS campaign',
    fr: 'Échec du chargement de la campagne texto'
  },
  errorGenerateSms: {
    en: 'Failed to generate SMS content',
    fr: 'Échec de la génération du contenu SMS'
  },
  generateWithAI: {
    en: 'Generate with AI',
    fr: 'Générer avec IA'
  },
  charactersRemaining: {
    en: 'characters remaining',
    fr: 'caractères restants'
  },
  characterCount: {
    en: 'characters',
    fr: 'caractères'
  },
  smsSegments: {
    en: 'SMS segments',
    fr: 'segments SMS'
  }
} as const

export type TranslationKey = keyof typeof translations

export function t(key: TranslationKey, lang: Language): string {
  return translations[key][lang]
}

// Get day translations as array for forms
export function getDaysOfWeek(lang: Language) {
  return [
    { id: 'monday', label: t('monday', lang) },
    { id: 'tuesday', label: t('tuesday', lang) },
    { id: 'wednesday', label: t('wednesday', lang) },
    { id: 'thursday', label: t('thursday', lang) },
    { id: 'friday', label: t('friday', lang) },
    { id: 'saturday', label: t('saturday', lang) },
    { id: 'sunday', label: t('sunday', lang) }
  ]
}
