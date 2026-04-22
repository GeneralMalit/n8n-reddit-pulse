RedditPulse 

Handling images in a Reddit-based workflow is a classic "Engineering vs. Expense" trade-off. Discarding them is bad for the UX (since rants often live in screenshots of text), but multimodal LLMs can eat your budget if you aren't strategic.

To be frank, since you're already in the **Paid Tier** and have access to **Gemini 3 Flash**, you have a massive advantage: **Gemini 3 Flash is multimodal by default** and is extremely cost-efficient for image processing compared to competitors.

Here is the objective strategy to handle image posts without breaking the bank:

### 1. The "Cheap" Multimodal Flow
Instead of a separate OCR node (which is slow and adds another point of failure), use n8n’s **Binary Data** handling.
* **Extraction:** When the Reddit `.json` indicates a post is a `hint:image`, n8n uses an **HTTP Request** node to download the image as a binary buffer.
* **Smart Filtering (JS):** Don't process every image. Write a JS node to check the `post_hint`. If it’s a "Gallery" or "Image," pass the binary data to the LLM. 
* **The "One-Call" Summary:** You send the **Image Binary + Post Title + Any Text** in a *single* call to Gemini 3 Flash. 
    * **Prompt:** *"Combine the visual context of this image (e.g., text in a screenshot) with the title to provide a 2-sentence gist of the user's grievance."*

### 2. Handling "Image Heavy" vs "Text Heavy" Subreddits
To keep costs even lower, your **Supabase `user_subscriptions` table** should have a toggle: `process_images (boolean)`.
* **r/codex:** Likely code snippets or text. You can probably disable image processing here and just use the text body.
* **r/RantAndVentPH:** High probability of screenshots of conversations or social media rants. Enable image processing here.

### 3. The Data Structure (Frontend Integration)
On your React frontend, the card needs to handle these two states gracefully. Your Supabase `daily_summaries` table should include a `media_url` and a `context_type` column.

**Card Component Logic:**
* **If text-only:** Show the 2-sentence summary.
* **If image-based:** Show the summary + a small "View Original Image" thumbnail. This keeps your card summary clean but preserves the context if the user wants to verify the "gist."

---

## High-Level Architecture Overview



### Stage 1: The Ingestor (n8n)
* **Trigger:** Manual button from your React app.
* **Worker:** n8n pulls the top 10 posts from your selected subreddits.

### Stage 2: The Router (JavaScript)
* **Condition A (Selftext):** If the post has a long body, send only text to the LLM.
* **Condition B (Image):** If it’s an image, download the binary and send it to the LLM.
* **Condition C (Low Value):** If it's just a meme (low word count + low karma-to-time ratio), discard it to save money.

### Stage 3: The Persistent Layer (Supabase)
* Save the final `summary`, `original_link`, and `image_preview_url`.

### Stage 4: The UI (React)
* Map through the `daily_summaries` and render the **Cards**.

### The "Lead Engineer" Verdict on Costs:
By 2026, **Gemini 3 Flash** is priced roughly at **$0.125 per 1M input tokens** (including images). Even if you process 100 image-heavy rants a day, your daily cost will likely be **less than ₱5 ($0.10)**. The "risk" of high costs is actually quite low as long as you aren't using the more expensive "Pro" or "Ultra" models for simple summaries.

Would you like to start with the **n8n nodes** for downloading the image binary, or the **React code** for displaying the summary cards?