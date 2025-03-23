guardrails = """
Please ensure that the generated content:
1. Is factually accurate and based on the provided details
2. Uses proper grammar and punctuation
3. Is written in a professional tone
4. Avoids controversial or sensitive topics
5. Does not include any personal opinions
6. Follows the specified brand voice guidelines
"""

context_instructions = """
When generating content, consider:
1. The target audience demographics
2. Brand voice and messaging guidelines
3. Product features and benefits
4. Intended use cases
5. Technical specifications
6. Quality standards
"""

default_system_prompt = guardrails + "\n" + context_instructions

claude_content_template = """
You are a helpful AI assistant. Your task is to {task}.

Please follow these guidelines:
{guidelines}

Here is the content to work with:
{content}

Additional context:
{context}
"""

image_search_default_prompt = """
Please analyze this image and identify:
1. Main objects and subjects
2. Colors and visual elements
3. Style and composition
4. Text or labels if present
5. Overall theme or mood

Format the response as a JSON object with appropriate attributes.
"""