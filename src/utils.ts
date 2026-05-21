import { BANNED_TRADEMARKS } from './constants';
import { QueueItem, ComplianceResult, ComplianceViolation } from './types';
import {
  BANNED_STYLE_PHRASES,
  BANNED_FICTIONAL_NAMES,
  BANNED_CELEBRITIES,
  BANNED_ARTISTS,
  BANNED_MOVIE_FRANCHISES,
  BANNED_ANIME_SERIES,
  BANNED_GAME_FRANCHISES,
  BANNED_BRANDS,
  BANNED_NEWS_EVENTS,
  ALL_BANNED_TERMS,
  COMPLIANCE_REGEX_PATTERNS
} from './constants/compliance';

// =========================================
// MICROSTOCK COMPLIANCE FILTER SYSTEM
// For Adobe Stock, Shutterstock, Freepik, iStock, Vecteezy, Canva, Dreamstime
// =========================================

/**
 * Scan text for compliance violations across all banned categories
 */
export function scanComplianceViolations(
  text: string,
  field: 'title' | 'description' | 'keywords' | 'prompt' = 'title'
): ComplianceViolation[] {
  if (!text) return [];

  const violations: ComplianceViolation[] = [];
  const lowerText = text.toLowerCase();

  // Check style reference phrases
  BANNED_STYLE_PHRASES.forEach(phrase => {
    if (lowerText.includes(phrase)) {
      violations.push({
        type: 'style',
        term: phrase,
        field,
        severity: 'high'
      });
    }
  });

  // Check regex patterns for variations
  Object.entries(COMPLIANCE_REGEX_PATTERNS).forEach(([patternName, regex]) => {
    const matches = lowerText.match(regex);
    if (matches) {
      matches.forEach(match => {
        const trimmedMatch = match.trim();
        // Avoid duplicate violations
        if (!violations.some(v => v.term === trimmedMatch)) {
          let violationType: ComplianceViolation['type'] = 'brand';
          let severity: ComplianceViolation['severity'] = 'medium';

          if (patternName.includes('style')) {
            violationType = 'style';
            severity = 'high';
          } else if (patternName.includes('fictional')) {
            violationType = 'fictional';
            severity = 'high';
          } else if (patternName.includes('celebrity')) {
            violationType = 'celebrity';
            severity = 'high';
          } else if (patternName.includes('media')) {
            violationType = 'media';
            severity = 'high';
          } else if (patternName.includes('news')) {
            violationType = 'news';
            severity = 'medium';
          }

          violations.push({
            type: violationType,
            term: trimmedMatch,
            field,
            severity
          });
        }
      });
    }
  });

  // Check banned arrays with fuzzy lowercase comparison
  const checkBannedList = (
    list: string[],
    type: ComplianceViolation['type'],
    severity: ComplianceViolation['severity']
  ) => {
    list.forEach(term => {
      const termLower = term.toLowerCase();
      // Check for exact word boundary match or inclusion
      const wordBoundaryRegex = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (wordBoundaryRegex.test(lowerText) || lowerText.includes(termLower)) {
        if (!violations.some(v => v.term.toLowerCase() === termLower)) {
          violations.push({
            type,
            term,
            field,
            severity
          });
        }
      }
    });
  };

  checkBannedList(BANNED_FICTIONAL_NAMES, 'fictional', 'high');
  checkBannedList(BANNED_CELEBRITIES, 'celebrity', 'high');
  checkBannedList(BANNED_ARTISTS, 'artist', 'high');
  checkBannedList(BANNED_MOVIE_FRANCHISES, 'media', 'high');
  checkBannedList(BANNED_ANIME_SERIES, 'media', 'high');
  checkBannedList(BANNED_GAME_FRANCHISES, 'media', 'high');
  checkBannedList(BANNED_BRANDS, 'brand', 'high');
  checkBannedList(BANNED_NEWS_EVENTS, 'news', 'medium');

  return violations;
}

/**
 * Calculate compliance score based on violations found
 */
export function calculateComplianceScore(violations: ComplianceViolation[]): number {
  if (violations.length === 0) return 100;

  let score = 100;
  violations.forEach(violation => {
    switch (violation.severity) {
      case 'high':
        score -= 15;
        break;
      case 'medium':
        score -= 8;
        break;
      case 'low':
        score -= 3;
        break;
    }
  });

  return Math.max(0, score);
}

/**
 * Sanitize metadata by removing banned terms and phrases
 */
export function sanitizeComplianceMetadata(metadata: {
  title: string;
  description: string;
  keywords: string[];
}): {
  title: string;
  description: string;
  keywords: string[];
  warnings: string[];
} {
  const warnings: string[] = [];

  // Helper function to remove banned terms from text
  const cleanText = (text: string, fieldName: string): string => {
    let cleaned = text;
    const lowerCleaned = cleaned.toLowerCase();

    // Remove style phrases
    BANNED_STYLE_PHRASES.forEach(phrase => {
      const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, '');
        warnings.push(`Removed style phrase "${phrase}" from ${fieldName}`);
      }
    });

    // Apply regex pattern cleaning
    Object.entries(COMPLIANCE_REGEX_PATTERNS).forEach(([, regex]) => {
      const matches = cleaned.match(regex);
      if (matches) {
        matches.forEach(match => {
          const escapedMatch = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const removeRegex = new RegExp(escapedMatch, 'gi');
          cleaned = cleaned.replace(removeRegex, '');
        });
        if (matches.length > 0) {
          warnings.push(`Removed ${matches.length} banned pattern match(es) from ${fieldName}`);
        }
      }
    });

    // Remove banned terms from lists
    const allBannedTerms = [
      ...BANNED_FICTIONAL_NAMES,
      ...BANNED_CELEBRITIES,
      ...BANNED_ARTISTS,
      ...BANNED_MOVIE_FRANCHISES,
      ...BANNED_ANIME_SERIES,
      ...BANNED_GAME_FRANCHISES,
      ...BANNED_BRANDS
    ];

    allBannedTerms.forEach(term => {
      const termLower = term.toLowerCase();
      const wordBoundaryRegex = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (wordBoundaryRegex.test(cleaned)) {
        cleaned = cleaned.replace(wordBoundaryRegex, '');
        warnings.push(`Removed banned term "${term}" from ${fieldName}`);
      }
    });

    // Clean up extra spaces and punctuation issues
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    cleaned = cleaned.replace(/\s+[,.;:!?]/g, ',');
    cleaned = cleaned.replace(/^[,.;:!?]+|[,.;:!?]+$/g, '');

    return cleaned;
  };

  // Clean title
  let sanitizedTitle = cleanText(metadata.title || '', 'title');
  if (!sanitizedTitle) {
    sanitizedTitle = 'Commercial lifestyle image';
    warnings.push('Title was empty after sanitization, using generic fallback');
  }

  // Clean description
  let sanitizedDescription = cleanText(metadata.description || '', 'description');
  if (!sanitizedDescription) {
    sanitizedDescription = 'Professional commercial asset suitable for various design projects.';
    warnings.push('Description was empty after sanitization, using generic fallback');
  }

  // Clean keywords
  const sanitizedKeywords = metadata.keywords
    .map(kw => {
      let cleanedKw = kw;
      const lowerKw = cleanedKw.toLowerCase();

      // Check against all banned lists
      const allBannedTerms = [
        ...BANNED_FICTIONAL_NAMES,
        ...BANNED_CELEBRITIES,
        ...BANNED_ARTISTS,
        ...BANNED_MOVIE_FRANCHISES,
        ...BANNED_ANIME_SERIES,
        ...BANNED_GAME_FRANCHISES,
        ...BANNED_BRANDS,
        ...BANNED_STYLE_PHRASES
      ];

      allBannedTerms.forEach(term => {
        const termLower = term.toLowerCase();
        if (lowerKw === termLower || lowerKw.includes(termLower)) {
          cleanedKw = '';
          warnings.push(`Removed banned keyword "${term}"`);
        }
      });

      // Apply regex patterns
      Object.values(COMPLIANCE_REGEX_PATTERNS).forEach(regex => {
        if (regex.test(lowerKw)) {
          cleanedKw = '';
          warnings.push(`Removed keyword matching banned pattern: "${kw}"`);
        }
      });

      return cleanedKw.trim();
    })
    .filter(kw => kw.length > 0 && kw.length <= 50);

  // Remove duplicate keywords after sanitization
  const uniqueKeywords = Array.from(new Set(sanitizedKeywords.map(k => k.toLowerCase())))
    .map(lower => sanitizedKeywords.find(k => k.toLowerCase() === lower) || '')
    .filter(Boolean);

  return {
    title: sanitizedTitle,
    description: sanitizedDescription,
    keywords: uniqueKeywords,
    warnings
  };
}

/**
 * Full compliance check and sanitization pipeline
 */
export function enforceCompliance(metadata: {
  title: string;
  description: string;
  keywords: string[];
}, prompt?: string): {
  metadata: {
    title: string;
    description: string;
    keywords: string[];
  };
  complianceResult: ComplianceResult;
} {
  // Scan for violations
  const titleViolations = scanComplianceViolations(metadata.title, 'title');
  const descViolations = scanComplianceViolations(metadata.description, 'description');
  const keywordViolations = metadata.keywords.flatMap(kw =>
    scanComplianceViolations(kw, 'keywords')
  );
  const promptViolations = prompt ? scanComplianceViolations(prompt, 'prompt') : [];

  const allViolations = [...titleViolations, ...descViolations, ...keywordViolations, ...promptViolations];

  // Calculate compliance score
  const complianceScore = calculateComplianceScore(allViolations);

  // Generate warnings
  const warnings = allViolations.map(v =>
    `Detected ${v.type} reference: "${v.term}" in ${v.field}`
  );

  // Sanitize metadata
  const sanitized = sanitizeComplianceMetadata(metadata);

  // Add sanitization warnings
  warnings.push(...sanitized.warnings);

  return {
    metadata: {
      title: sanitized.title,
      description: sanitized.description,
      keywords: sanitized.keywords
    },
    complianceResult: {
      complianceScore,
      warnings,
      violationsFound: allViolations
    }
  };
}

/**
 * Generate compliance-safe AI prompt instructions
 */
export const COMPLIANCE_PROMPT_INSTRUCTIONS = `COMPLIANCE RULES - MANDATORY FOR MICROSTOCK ACCEPTANCE:
- Do not mention any brand names (Apple, Nike, BMW, Sony, etc.)
- Do not mention copyrighted artists or art styles (Van Gogh, Picasso, Disney, etc.)
- Do not mention fictional characters (Mickey Mouse, Batman, Naruto, Mario, etc.)
- Do not mention celebrities or public figures (Taylor Swift, Elon Musk, etc.)
- Do not generate style references ("in the style of", "inspired by", etc.)
- Do not imply real news events, elections, protests, or political content
- Generate fully generic commercial metadata that is safe for all microstock platforms
- Use descriptive, generic terms only (e.g., "athletic shoes" not "Nike")
- Focus on visual elements, colors, composition, and commercial concepts
- All output must pass Adobe Stock, Shutterstock, and Freepik compliance checks`;

// =========================================
// MICROSTOCK SEO UTILITIES
// =========================================

// Commercial keywords with high buyer intent (priority order)
const COMMERCIAL_KEYWORDS = [
  'copy space',
  'background',
  'banner',
  'template',
  'flat lay',
  'top view',
  'commercial',
  'advertising',
  'mockup'
];

// Spam/low-value keywords blacklist for microstock 2026
const SPAM_KEYWORDS_BLACKLIST = [
  'beautiful',
  'awesome',
  'cool',
  'nice',
  'amazing',
  'best quality',
  'ultra hd',
  'masterpiece'
];

/**
 * Sort keywords by SEO value and buyer intent
 * Prioritizes commercial keywords first, then alphabetical
 */
export function sortKeywordsBySEO(keywords: string[]): string[] {
  if (!keywords || keywords.length === 0) return [];

  const lowerKeywords = keywords.map(kw => kw.toLowerCase().trim());
  
  // Separate commercial priority keywords from regular keywords
  const commercialKeywords: string[] = [];
  const regularKeywords: string[] = [];

  lowerKeywords.forEach(kw => {
    if (COMMERCIAL_KEYWORDS.some(commercial => kw.includes(commercial) || commercial.includes(kw))) {
      if (!commercialKeywords.includes(kw)) {
        commercialKeywords.push(kw);
      }
    } else {
      if (!regularKeywords.includes(kw)) {
        regularKeywords.push(kw);
      }
    }
  });

  // Sort commercial keywords by priority order
  commercialKeywords.sort((a, b) => {
    const aIndex = COMMERCIAL_KEYWORDS.findIndex(ck => a.includes(ck) || ck.includes(a));
    const bIndex = COMMERCIAL_KEYWORDS.findIndex(ck => b.includes(ck) || ck.includes(b));
    return aIndex - bIndex;
  });

  // Sort regular keywords alphabetically
  regularKeywords.sort();

  return [...commercialKeywords, ...regularKeywords];
}

/**
 * Generate long-tail keyword variations from base keywords
 * Creates more specific, searchable combinations for modern microstock platforms
 */
export function generateLongTailKeywords(keywords: string[], maxVariations: number = 10): string[] {
  if (!keywords || keywords.length < 2) return [];

  const longTailKeywords: string[] = [];
  const commonModifiers = ['modern', 'professional', 'creative', 'minimal', 'vintage', '3d render', 'isolated', 'transparent background'];
  
  // Generate combination keywords
  for (let i = 0; i < keywords.length && longTailKeywords.length < maxVariations; i++) {
    for (let j = i + 1; j < keywords.length && longTailKeywords.length < maxVariations; j++) {
      const combined = `${keywords[i]} ${keywords[j]}`;
      if (combined.length <= 50 && !keywords.includes(combined)) {
        longTailKeywords.push(combined);
      }
    }
    
    // Add modifier combinations for main keywords
    if (i < 5) {
      commonModifiers.slice(0, 3).forEach(modifier => {
        if (longTailKeywords.length < maxVariations) {
          const modified = `${modifier} ${keywords[i]}`;
          if (!keywords.includes(modified) && !longTailKeywords.includes(modified)) {
            longTailKeywords.push(modified);
          }
        }
      });
    }
  }

  return longTailKeywords;
}

/**
 * Filter out spam and low-value keywords
 * Removes subjective adjectives and technical specs that don't improve searchability
 */
export function filterSpamKeywords(keywords: string[]): string[] {
  if (!keywords || keywords.length === 0) return [];

  return keywords.filter(kw => {
    const lowerKw = kw.toLowerCase().trim();
    return !SPAM_KEYWORDS_BLACKLIST.some(spam => 
      lowerKw === spam || lowerKw.includes(spam)
    );
  });
}

/**
 * Sanitize keywords for microstock compliance
 * - Remove special characters except alphanumeric and hyphens
 * - Normalize to lowercase
 * - Remove duplicates
 * - Filter out forbidden technical terms
 * - Ensure keyword length between 2-50 characters
 */
export function sanitizeKeywords(keywords: string[], maxCount: number = 35): string[] {
  if (!keywords || keywords.length === 0) return [];

  // Forbidden technical/medium indicators for microstock 2026
  const FORBIDDEN_TERMS = [
    '4k', '8k', 'hd', 'uhd', 'hdr', 'resolution', 'megapixel', 'mp',
    'camera', 'dslr', 'canon', 'nikon', 'sony', 'fujifilm', 'panasonic',
    'photography', 'photo', 'photograph', 'image', 'picture', 'pic',
    'vector', 'illustration', 'clipart', 'eps', 'ai', 'svg', 'png', 'jpg', 'jpeg',
    'ultra', 'high quality', 'best quality', 'masterpiece', 'render', '3d render',
    'file', 'download', 'free', 'sample', 'preview', 'watermark'
  ];

  // Step 1: Clean and normalize each keyword
  const cleaned = keywords
    .map(kw => String(kw))
    .map(kw => kw.trim())
    .map(kw => kw.replace(/[^a-z0-9\s-]/gi, '')) // Remove special chars except alphanumeric and hyphen
    .map(kw => kw.toLowerCase())
    .map(kw => kw.replace(/\s+/g, ' ')) // Normalize multiple spaces to single space
    .filter(kw => kw.length >= 2 && kw.length <= 50); // Enforce length limits

  // Step 2: Remove forbidden terms
  const filtered = cleaned.filter(kw => {
    return !FORBIDDEN_TERMS.some(term => 
      kw === term || kw.includes(term)
    );
  });

  // Step 3: Remove duplicates (case-insensitive)
  const unique = Array.from(new Set(filtered));

  // Step 4: Limit to max count
  return unique.slice(0, maxCount);
}

/**
 * Apply user preferences to metadata output
 * - Enforces title length limit
 * - Enforces description length limit  
 * - Enforces exact keyword count
 * - Prioritizes key concepts if provided
 */
export function applyUserPreferences(
  metadata: { title: string; description: string; keywords: string[] },
  settings: {
    titleLength?: number;
    descLength?: number;
    keywordsCount?: number;
    keyConcepts?: string;
  }
): { title: string; description: string; keywords: string[] } {
  const titleLimit = settings.titleLength || 70;
  const descLimit = settings.descLength || 160;
  const keywordCount = settings.keywordsCount || 35;
  const keyConcepts = settings.keyConcepts?.split(',').map(c => c.trim().toLowerCase()).filter(Boolean) || [];

  // Apply title truncation
  let title = truncateByCharacters(metadata.title || '', titleLimit);

  // Apply description truncation
  let description = truncateByCharacters(metadata.description || '', descLimit);

  // Apply keyword sanitization and count enforcement
  let keywords = sanitizeKeywords(metadata.keywords || [], keywordCount);

  // Prioritize key concepts by moving them to the front
  if (keyConcepts.length > 0) {
    const remainingKeywords = keywords.filter(kw => !keyConcepts.includes(kw));
    const matchedConcepts = keyConcepts.filter(concept => 
      keywords.some(kw => kw === concept || kw.includes(concept))
    );
    
    // Add concepts that weren't found (optional fallback)
    const unmatchedConcepts = keyConcepts.filter(concept => 
      !matchedConcepts.includes(concept)
    );
    
    keywords = [...matchedConcepts, ...remainingKeywords].slice(0, keywordCount);
    
    // If still under count, add back unmatched concepts as new keywords
    if (keywords.length < keywordCount && unmatchedConcepts.length > 0) {
      for (const concept of unmatchedConcepts) {
        if (keywords.length >= keywordCount) break;
        if (!keywords.includes(concept)) {
          keywords.push(concept);
        }
      }
    }
  }

  // Final trim to exact count
  keywords = keywords.slice(0, keywordCount);

  return {
    title,
    description,
    keywords
  };
}

/**
 * Detect commercial intent in keywords
 * Returns score 0-100 based on buyer intent strength
 */
export function detectCommercialIntent(keywords: string[]): number {
  if (!keywords || keywords.length === 0) return 0;

  let score = 0;
  const lowerKeywords = keywords.map(kw => kw.toLowerCase());

  // Check for commercial keywords presence
  COMMERCIAL_KEYWORDS.forEach(commercial => {
    if (lowerKeywords.some(kw => kw.includes(commercial))) {
      score += 15;
    }
  });

  // Check for action/buyer intent words
  const buyerIntentWords = ['buy', 'sale', 'download', 'vector', 'eps', 'png', 'svg', 'editable', 'customizable', 'printable', 'template', 'kit', 'bundle', 'pack', 'set'];
  buyerIntentWords.forEach(word => {
    if (lowerKeywords.some(kw => kw.includes(word))) {
      score += 5;
    }
  });

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Optimize keywords for microstock platforms (Adobe Stock, Shutterstock, Freepik, iStock 2026)
 * Combines all SEO optimizations: filtering, sorting, long-tail generation, deduplication
 * Limits to maximum 35 keywords as per platform best practices
 */
export function optimizeMicrostockKeywords(keywords: string[], maxKeywords: number = 35): string[] {
  if (!keywords || keywords.length === 0) return [];

  // Step 1: Clean and normalize keywords
  let cleaned = keywords
    .map(kw => kw.trim())
    .filter(kw => kw.length > 0 && kw.length <= 50);

  // Step 2: Remove duplicates (case-insensitive)
  const seen = new Set<string>();
  cleaned = cleaned.filter(kw => {
    const lower = kw.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  // Step 3: Filter spam keywords
  cleaned = filterSpamKeywords(cleaned);

  // Step 4: Generate long-tail variations
  const longTail = generateLongTailKeywords(cleaned, 10);
  cleaned = [...cleaned, ...longTail];

  // Step 5: Remove duplicates again after long-tail generation
  seen.clear();
  cleaned = cleaned.filter(kw => {
    const lower = kw.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  // Step 6: Sort by SEO value
  cleaned = sortKeywordsBySEO(cleaned);

  // Step 7: Limit to max keywords
  cleaned = cleaned.slice(0, maxKeywords);

  return cleaned;
}

/**
 * Truncate text by character count without cutting words
 * Ensures natural sentence breaks
 */
export function truncateByCharacters(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || '';
  
  // Try to cut at last space before maxChars
  let truncated = text.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxChars * 0.7) {
    // Cut at word boundary if we're past 70% of max length
    truncated = truncated.substring(0, lastSpace);
  }
  
  // Ensure we don't end with punctuation issues
  truncated = truncated.replace(/[.,!?;:]+$/, '');
  
  return truncated.trim();
}

/**
 * Truncate text by word count
 * Keeps exactly N words
 */
export function truncateByWords(text: string, maxWords: number): string {
  if (!text) return '';
  
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= maxWords) return text;
  
  return words.slice(0, maxWords).join(' ').trim();
}

/**
 * Sanitize metadata output to enforce user preferences
 * Enforces title length, description length, and keyword count limits
 */
export function sanitizeMetadataOutput(
  metadata: { title: string; description: string; keywords: string[] },
  settings: {
    titleLength?: number;
    descLength?: number;
    keywordsCount?: number;
  }
): { title: string; description: string; keywords: string[] } {
  // Default values if settings are missing
  const titleLimit = settings.titleLength || 70;
  const descLimit = settings.descLength || 160;
  const keywordCount = settings.keywordsCount || 35;

  console.log("Applied AI Preferences:", {
    titleLength: titleLimit,
    keywordsCount: keywordCount,
    descriptionLength: descLimit
  });

  // Sanitize title
  let sanitizedTitle = (metadata.title || '').trim();
  sanitizedTitle = truncateByCharacters(sanitizedTitle, titleLimit);

  // Sanitize description
  let sanitizedDescription = (metadata.description || '').trim();
  sanitizedDescription = truncateByCharacters(sanitizedDescription, descLimit);

  // Sanitize keywords
  let sanitizedKeywords = metadata.keywords || [];
  
  // Clean keywords: trim, remove empty, remove duplicates
  sanitizedKeywords = sanitizedKeywords
    .map(kw => kw.trim())
    .filter(kw => kw.length > 0 && kw.length <= 50);
  
  // Remove duplicates (case-insensitive)
  const seen = new Set<string>();
  sanitizedKeywords = sanitizedKeywords.filter(kw => {
    const lower = kw.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
  
  // Remove spam keywords
  sanitizedKeywords = filterSpamKeywords(sanitizedKeywords);
  
  // Apply SEO optimization (includes sorting by commercial intent)
  sanitizedKeywords = optimizeMicrostockKeywords(sanitizedKeywords, keywordCount);
  
  // Ensure exact keyword count
  if (sanitizedKeywords.length > keywordCount) {
    sanitizedKeywords = sanitizedKeywords.slice(0, keywordCount);
  }

  return {
    title: sanitizedTitle,
    description: sanitizedDescription,
    keywords: sanitizedKeywords
  };
}

// =========================================
// EXISTING UTILITY FUNCTIONS
// =========================================

// Scan text for potential IP or Trademark violations
export function scanIPViolations(text: string): string[] {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  const detected: string[] = [];
  
  BANNED_TRADEMARKS.forEach(brand => {
    const regex = new RegExp(`\\b${brand}\\b`, 'i');
    if (regex.test(lowerText)) {
      detected.push(brand);
    }
  });
  
  return detected;
}

// Measure SEO quality of title and keywords
export function measureSEOQuality(item: QueueItem): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];
  const title = item.metadata.title || "";
  const description = item.metadata.description || "";
  let keywords = item.metadata.keywords || [];

  // Optimize keywords using new SEO function
  keywords = optimizeMicrostockKeywords(keywords);

  // Title validation
  if (title.length < 15) {
    score -= 20;
    issues.push("Judul terlalu pendek (kurang dari 15 karakter)");
  } else if (title.length > (item.settings?.titleLength || 80) + 20) {
    score -= 10;
    issues.push("Judul melebihi preferensi target");
  }

  // Description validation
  if (description.length < 30) {
    score -= 15;
    issues.push("Deskripsi terlalu singkat (kurang dari 30 karakter)");
  }

  // Keywords counts
  const targetKeywords = item.settings?.keywordsCount || 40;
  if (keywords.length < 15) {
    score -= 25;
    issues.push("Jumlah kata kunci terlalu sedikit (kurang dari 15)");
  } else if (keywords.length < targetKeywords - 5) {
    score -= 10;
    issues.push(`Target kata kunci belum maksimal (baru ${keywords.length}/${targetKeywords})`);
  }

  // Low value keywords detection (spam metrics)
  const lowValueKeywords = ['cool', 'nice', 'beautiful', 'image', 'photo', 'vector', 'illustration', 'clipart', 'camera', 'dslr'];
  const spamDetected = keywords.filter(kw => lowValueKeywords.includes(kw.toLowerCase()));
  if (spamDetected.length > 0) {
    score -= (spamDetected.length * 5);
    issues.push(`Terdeteksi kata kunci bernilai rendah/spam (${spamDetected.slice(0, 3).join(', ')})`);
  }

  // Trademark detection in keywords check
  const trademarkKws = keywords.filter(kw => {
    const violations = scanIPViolations(kw);
    return violations.length > 0;
  });
  if (trademarkKws.length > 0) {
    score -= 30;
    issues.push(`Mengandung keyword trademark terlarang (${trademarkKws.join(', ')})`);
  }

  return {
    score: Math.max(score, 10),
    issues: issues
  };
}

// Generate metadata using Groq API
export async function generateMetadata(imageDescription: string): Promise<string> {
  const response = await fetch("/api/generate-metadata", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageDescription }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Gagal menghasilkan metadata");
  }
  return data.content;
}

// Image compression
export function resizeAndCompressImage(
  base64Str: string,
  maxWidth = 1024,
  maxHeight = 1024
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64Str}`;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate optimal resolution
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
      }

      // Compress to JPEG with 75% quality for performance
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
      resolve(compressedDataUrl.split(',')[1]);
    };
    img.onerror = () => {
      resolve(base64Str); // Fallback
    };
  });
}

// Extract three frames from video: Start (10%), Middle (50%), End (90%)
export function extractVideoFrames(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const timestamps = [duration * 0.1, duration * 0.5, duration * 0.9];
      const frames: string[] = [];
      let index = 0;

      const captureFrame = () => {
        if (index >= timestamps.length) {
          URL.revokeObjectURL(video.src);
          resolve(frames);
          return;
        }
        video.currentTime = timestamps[index];
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        const dataUrl = canvas.toDataURL('image/png');
        frames.push(dataUrl.split(',')[1]);
        index++;
        captureFrame();
      };

      captureFrame();
    };

    video.onerror = () => {
      resolve([]);
    };
  });
}

// CSV Generator conforming to microstock specifications
export function generatePlatformCSV(successItems: QueueItem[], platformKey: string): void {
  if (successItems.length === 0) return;

  let csvContent = "";
  let fileName = "";

  const sanitizeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;

  switch (platformKey) {
    case 'shutterstock':
      csvContent = "Filename,Description,Keywords,Category 1,Category 2\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.description),
          sanitizeCSV(i.metadata.keywords.join(',')),
          sanitizeCSV(i.metadata.categories?.shutterstock1 || 'Abstract'),
          sanitizeCSV(i.metadata.categories?.shutterstock2 || '')
        ].join(",")).join("\n");
      fileName = `shutterstock_batch_${Date.now()}.csv`;
      break;

    case 'adobeStock':
      csvContent = "Filename,Title,Keywords,Category\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.keywords.join(',')),
          sanitizeCSV(i.metadata.categories?.adobeStock || 'Graphics')
        ].join(",")).join("\n");
      fileName = `adobe_stock_batch_${Date.now()}.csv`;
      break;

    case 'freepik':
      csvContent = "Filename,Title,Keywords\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.keywords.join(','))
        ].join(",")).join("\n");
      fileName = `freepik_batch_${Date.now()}.csv`;
      break;

    case 'istock':
      csvContent = "Filename,Title,Description,Keywords\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.description),
          sanitizeCSV(i.metadata.keywords.join(','))
        ].join(",")).join("\n");
      fileName = `istock_getty_batch_${Date.now()}.csv`;
      break;

    case 'vecteezy':
      csvContent = "Filename,Title,Description,Keywords,Category\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.description),
          sanitizeCSV(i.metadata.keywords.join(',')),
          sanitizeCSV(i.metadata.categories?.vecteezy || 'Backgrounds')
        ].join(",")).join("\n");
      fileName = `vecteezy_batch_${Date.now()}.csv`;
      break;

    case 'canva':
      csvContent = "Filename,Title,Description,Keywords,Theme\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.description),
          sanitizeCSV(i.metadata.keywords.join(',')),
          sanitizeCSV(i.metadata.categories?.canva || 'Elements')
        ].join(",")).join("\n");
      fileName = `canva_batch_${Date.now()}.csv`;
      break;

    case 'dreamstime':
      csvContent = "Filename,Title,Description,Keywords,Category\n" + 
        successItems.map(i => [
          sanitizeCSV(i.name),
          sanitizeCSV(i.metadata.title),
          sanitizeCSV(i.metadata.description),
          sanitizeCSV(i.metadata.keywords.join(',')),
          sanitizeCSV(i.metadata.categories?.dreamstime || 'Abstract')
        ].join(",")).join("\n");
      fileName = `dreamstime_batch_${Date.now()}.csv`;
      break;

    default:
      return;
  }

  // Trigger browser download in UTF-8
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
