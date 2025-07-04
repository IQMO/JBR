# Documentation Style Guide

## Overview
This style guide establishes consistent standards for all project documentation to ensure clarity, professionalism, and maintainability across the entire documentation ecosystem.

## General Principles

### 1. Clarity and Conciseness
- Write for your audience's knowledge level
- Use clear, direct language
- Avoid jargon unless necessary (define when used)
- Keep sentences and paragraphs concise
- Use active voice when possible

### 2. Consistency
- Follow established naming conventions
- Use consistent terminology throughout all documents
- Maintain uniform formatting and structure
- Apply consistent style for similar content types

### 3. Accessibility
- Use inclusive language
- Provide alt text for images
- Structure content with proper headings hierarchy
- Ensure adequate color contrast
- Write for screen readers

### 4. Maintainability
- Include document metadata (author, date, version)
- Use version control for all documentation
- Set up review and update schedules
- Link related documents appropriately

## Document Structure Standards

### File Naming Conventions
```
Format: [TYPE]_[DESCRIPTIVE-NAME]_[VERSION].md

Examples:
- REQ_user-authentication_v1.2.md
- DESIGN_api-specification_v2.0.md
- MANUAL_admin-guide_v1.0.md
- RELEASE_notes_v2.1.0.md
```

### Folder Structure
```
.taskmaster/docs/
├── templates/           # Document templates
├── requirements/        # Requirements documents
├── design/             # Design specifications
├── user-guides/        # User manuals and guides
├── release-notes/      # Release documentation
├── api/               # API documentation
├── research/          # Research and analysis documents
└── archive/           # Deprecated documents
```

### Document Metadata
Every document must include this header:
```markdown
---
title: [Document Title]
type: [Document Type]
version: [Version Number]
date: [YYYY-MM-DD]
author: [Author Name(s)]
reviewers: [Reviewer Name(s)]
status: [Draft/Review/Approved/Deprecated]
last-updated: [YYYY-MM-DD]
related-docs: [Links to related documents]
---
```

## Markdown Style Standards

### Headings
- Use ATX-style headings (`#` syntax)
- Use sentence case (First word capitalized)
- Include only one H1 per document
- Follow logical hierarchy (don't skip levels)
- Use descriptive, not generic headings

```markdown
# Main Document Title (H1)
## Major Section (H2)
### Subsection (H3)
#### Detail Section (H4)
##### Minor Detail (H5)
###### Smallest Detail (H6)
```

### Lists
**Unordered Lists:**
- Use `-` for bullet points
- Maintain consistent indentation (2 spaces)
- Use parallel structure in list items

**Ordered Lists:**
1. Use numbers with periods
2. Maintain consistent indentation
3. Use for sequential steps or ranked items

**Task Lists:**
- [ ] Use for actionable items
- [x] Mark completed items
- [ ] Include clear, actionable descriptions

### Code and Technical Content

**Inline Code:**
- Use backticks for code elements: `variable`, `function()`, `file.txt`
- Include file paths: `src/components/Button.tsx`
- Highlight technical terms: `API`, `JSON`, `HTTP`

**Code Blocks:**
````markdown
```typescript
// Always specify language for syntax highlighting
interface UserData {
  id: string;
  email: string;
  createdAt: Date;
}
```
````

**File Names and Paths:**
- Use backticks: `package.json`, `src/utils/helpers.ts`
- Use forward slashes for paths (even on Windows)
- Include full paths when needed for clarity

### Tables
- Use proper table formatting
- Include headers
- Align content appropriately
- Use tables for structured data only

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |
```

### Links and References

**Internal Links:**
- Use relative paths: `[Related Document](../design/api-spec.md)`
- Include section anchors: `[Section](#section-heading)`
- Use descriptive link text (not "click here")

**External Links:**
- Use descriptive link text
- Include links to official documentation
- Verify links are current and accessible

**References:**
- Number references: [1], [2], [3]
- Include reference list at document end
- Use consistent citation format

### Images and Diagrams

**File Conventions:**
- Store in `docs/images/` or adjacent `images/` folder
- Use descriptive file names: `user-login-flow.png`
- Use web-optimized formats (PNG, JPG, SVG)

**Markdown Syntax:**
```markdown
![Alt text description](images/diagram-name.png)
*Figure 1: Caption describing the image*
```

**Alt Text Guidelines:**
- Describe the content and purpose
- Keep concise but informative
- Include context for understanding

## Writing Style Guidelines

### Tone and Voice
- **Professional but approachable**: Formal enough for business use, friendly enough for daily interaction
- **Clear and direct**: Get to the point quickly
- **Helpful and instructive**: Guide users toward success
- **Consistent**: Maintain the same tone throughout

### Grammar and Mechanics

**Person and Voice:**
- Use second person ("you") for user-facing documentation
- Use third person for technical specifications
- Prefer active voice: "Click the button" vs "The button should be clicked"

**Tense:**
- Use present tense for current features and functions
- Use future tense for planned features (clearly marked)
- Use past tense for deprecated features

**Punctuation:**
- Use serial/Oxford commas
- Single space after periods
- Use em dashes (—) for breaks in thought
- Use en dashes (–) for ranges

### Technical Writing Best Practices

**Procedures and Instructions:**
1. Use numbered lists for sequential steps
2. Start each step with an action verb
3. Include expected outcomes when helpful
4. Provide context for complex steps
5. Include troubleshooting for common issues

**Terminology:**
- Define technical terms on first use
- Maintain a glossary for complex documents
- Use consistent terminology throughout
- Prefer industry-standard terms

**Examples and Code:**
- Include relevant, working examples
- Test all code examples before publishing
- Provide context for code snippets
- Use realistic data in examples

## Content-Specific Guidelines

### Requirements Documents
- Use "must," "should," and "may" consistently
- Include acceptance criteria for each requirement
- Link requirements to business objectives
- Version requirements carefully

### Design Documents
- Include diagrams and visual aids
- Explain design decisions and trade-offs
- Link to related requirements
- Consider multiple audiences (developers, stakeholders)

### User Manuals
- Start with overview and getting started
- Use task-oriented organization
- Include screenshots and examples
- Provide troubleshooting sections

### API Documentation
- Include complete request/response examples
- Document all parameters and fields
- Provide error codes and meanings
- Include rate limiting and authentication info

### Release Notes
- Organize by impact and change type
- Include migration instructions for breaking changes
- Highlight security updates
- Provide rollback procedures

## Review and Quality Assurance

### Review Process
1. **Self-review**: Author checks formatting, links, and accuracy
2. **Peer review**: Technical review by team member
3. **Editorial review**: Style and clarity review
4. **Stakeholder review**: Business/product review if needed
5. **Final approval**: Document maintainer approval

### Quality Checklist
- [ ] Document metadata is complete and accurate
- [ ] Formatting follows style guide standards
- [ ] All links work and point to correct content
- [ ] Code examples are tested and functional
- [ ] Images include appropriate alt text
- [ ] Content is accurate and up-to-date
- [ ] Grammar and spelling are correct
- [ ] Document serves its intended purpose

### Maintenance Guidelines
- Review documents quarterly for accuracy
- Update links and references regularly
- Archive outdated documents properly
- Track document usage and feedback
- Update templates based on lessons learned

## Tools and Automation

### Recommended Tools
- **Markdown Editor**: VS Code with Markdown extensions
- **Diagram Creation**: Mermaid, Draw.io, or similar
- **Link Checking**: Automated link validation tools
- **Spell Check**: Integrated spell checking
- **Version Control**: Git for document versioning

### Automation Opportunities
- Automated link checking in CI/CD
- Spell check automation
- Template compliance checking
- Document freshness monitoring
- Automated generation from code comments

## Accessibility Standards

### Writing for Accessibility
- Use clear, simple language
- Provide context for technical terms
- Use descriptive headings and subheadings
- Include alt text for all images
- Ensure logical reading order

### Technical Accessibility
- Use semantic HTML when applicable
- Ensure adequate color contrast
- Don't rely solely on color for meaning
- Test with screen readers when possible
- Follow WCAG guidelines

## Internationalization Considerations

### Writing for Translation
- Use simple, clear sentence structure
- Avoid cultural references and idioms
- Use universal examples and imagery
- Consider text expansion in translations
- Maintain consistent terminology

### Technical Considerations
- Use Unicode-safe characters
- Consider right-to-left reading patterns
- Plan for longer translated text
- Use relative rather than absolute references

---

## Template Usage Instructions

### Selecting the Right Template
- **Requirements Template**: For functional and non-functional requirements
- **Design Template**: For technical design specifications
- **User Manual Template**: For end-user documentation
- **Release Notes Template**: For version release documentation

### Customizing Templates
1. Replace all `[placeholder text]` with actual content
2. Remove sections that don't apply to your project
3. Add sections specific to your needs
4. Maintain the overall structure and style
5. Update the metadata section completely

### Template Maintenance
- Templates are living documents
- Suggest improvements based on usage
- Update templates when style guide changes
- Version control template changes
- Communicate template updates to team

---

**Style Guide Version**: 1.0  
**Last Updated**: [Current Date]  
**Next Review Date**: [Date + 6 months]  
**Maintained By**: Documentation Team
