import { AiProvider, AiResponse } from './AiProvider.js';
import { ChatMessage, ProjectInfo } from '../octo.types.js';
import { QuestionClassifier } from './QuestionClassifier.js';

export class DemoAiProvider implements AiProvider {
  public readonly id = 'demo-simulator';
  public readonly name = 'OCTOBOT Demo Simulator (Offline)';
  public readonly model = 'demo-conversational-engine-v2';

  public isConfigured(): boolean {
    return true;
  }

  public async generateResponse(
    messages: ChatMessage[],
    systemPrompt: string,
    fileReferences: string[] = [],
    project?: ProjectInfo
  ): Promise<AiResponse> {
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage ? lastMessage.content.trim() : '';
    const lower = query.toLowerCase();

    // Classify the incoming message
    const classification = QuestionClassifier.classify(messages, project);

    let responseText = '';

    // =========================================================================
    // 0. Visual Screenshot & Error Inspection (Multimodal Gemma 4 / Vision Demo)
    // =========================================================================
    if (lastMessage?.images && lastMessage.images.length > 0) {
      responseText = `### 🔍 Visual Screenshot & Error Diagnosis

I have inspected the uploaded screenshot:

1. **Detected Error / Stack Trace**:
   - Stack trace / console output detected in image:
   - \`TypeError: Cannot read properties of undefined\` or failing assertion in \`PaymentService\`.
   - Associated component: \`src/services/PaymentService.ts\` (Line 44).

2. **Root Cause**:
   - A variable was dereferenced before validation, or a percentage value was computed without boundary checking.

3. **Recommended Fix**:
\`\`\`typescript
// Ensure guarded parameters and percentage division:
export function calculateTotal(subtotal: number = 0, discountPercentage: number = 0): number {
  const safeDiscount = (subtotal * Math.max(0, discountPercentage || 0)) / 100;
  return Math.max(0, subtotal - safeDiscount);
}
\`\`\`

4. **Verification**:
\`\`\`bash
npm run test
\`\`\`

*(Tip: In live mode with Gemma 4 or Google Gemini, OCTOBOT reads and analyzes stack traces and terminal captures directly via multimodal vision.)*`;
    }

    // =========================================================================
    // 1. Natural Greetings (Test 1: "Hi")
    // =========================================================================
    else if (classification.category === 'GREETING') {
      responseText = `Hello! I'm **OCTOBOT**, your developer assistant and coding mentor.

I can help you with:
- **Writing & generating code** in TypeScript, Python, Java, and other languages.
- **Learning core concepts** like Data Structures & Algorithms, APIs, and System Design.
- **Debugging & fixing errors** with concise, step-by-step root-cause analysis.
- **Git & GitHub workflows** and deployment guidance.
- **Navigating your active project** architecture and files.

What would you like to work on today?`;
    }

    // =========================================================================
    // 2. System Identity & Model Query (Test 9: "What AI model are you using?")
    // =========================================================================
    else if (classification.category === 'SYSTEM_IDENTITY') {
      responseText = `I am currently operating on the **OCTOBOT Demo Simulator Engine** (\`${this.model}\`) in offline simulation mode.

To connect OCTOBOT to a live large language model (Google Gemini or OpenAI):
1. Open \`apps/api/.env\` and add your API key:
   \`\`\`env
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your_actual_api_key_here
   AI_MODEL=gemini-1.5-flash
   \`\`\`
2. Or configure your provider and key in the **Settings** modal at the top right of the dashboard.`;
    }

    // =========================================================================
    // 3. Current Project Name (Test 8: "What is my current project name?")
    // =========================================================================
    else if (lower.includes('project name') || lower.includes('current project') || (lower.includes('project') && lower.includes('name'))) {
      const projectName = project?.name || 'OctoCommerce Service';
      const projectLang = project?.language || 'TypeScript';
      const projectDesc = project?.description || 'E-commerce and Authentication Core Service';

      responseText = `Your currently active project is **${projectName}**.

- **Language**: ${projectLang}
- **Framework**: ${project?.framework || 'Express + React'}
- **Version**: ${project?.version || '1.2.0'}
- **Description**: ${projectDesc}

You can ask me to explain its architecture, review specific files like \`src/services/PaymentService.ts\`, or diagnose failing unit tests.`;
    }

    // =========================================================================
    // 3b. Snapshot Comparison & Change Tracking Analysis
    // =========================================================================
    else if (
      systemPrompt.includes('[OCTOPUS SNAPSHOT COMPARISON REPORT]') ||
      systemPrompt.includes('[AUTO-DETECTED SNAPSHOT COMPARISON') ||
      systemPrompt.includes('[OCTOPUS SNAPSHOT STATUS]') ||
      ((lower.includes('snapshot') || lower.includes('track') || lower.includes('version')) &&
        (lower.includes('compare') || lower.includes('changed') || lower.includes('change') || lower.includes('between') || lower.includes('diff')))
    ) {
      if (systemPrompt.includes('[OCTOPUS SNAPSHOT COMPARISON REPORT]')) {
        const idx = systemPrompt.indexOf('[OCTOPUS SNAPSHOT COMPARISON REPORT]');
        const part = systemPrompt.slice(idx + '[OCTOPUS SNAPSHOT COMPARISON REPORT]'.length).trim();
        const endIdx = part.search(/\n\n\[|\n\n##/);
        responseText = endIdx !== -1 ? part.slice(0, endIdx).trim() : part;
      } else if (systemPrompt.includes('[AUTO-DETECTED SNAPSHOT COMPARISON')) {
        const idx = systemPrompt.indexOf('[AUTO-DETECTED SNAPSHOT COMPARISON');
        const headerEnd = systemPrompt.indexOf(']', idx);
        const header = headerEnd !== -1 ? systemPrompt.slice(idx + 1, headerEnd) : 'Snapshot Comparison';
        const part = systemPrompt.slice(headerEnd + 1).trim();
        const endIdx = part.search(/\n\n\[|\n\n##/);
        const body = endIdx !== -1 ? part.slice(0, endIdx).trim() : part;
        responseText = `### 🔍 ${header}\n\n${body}`;
      } else if (systemPrompt.includes('[OCTOPUS SNAPSHOT STATUS]')) {
        const idx = systemPrompt.indexOf('[OCTOPUS SNAPSHOT STATUS]');
        const part = systemPrompt.slice(idx + '[OCTOPUS SNAPSHOT STATUS]'.length).trim();
        const endIdx = part.search(/\n\n\[|\n\n##/);
        responseText = endIdx !== -1 ? part.slice(0, endIdx).trim() : part;
      } else if (project?.name) {
        responseText = `### 🔄 Snapshot Comparison for ${project.name}

To compare code changes between versions:
1. Ensure at least two snapshots exist for **${project.name}** (take new snapshots in VS Code using \`OCTOPUS: Take Snapshot\`).
2. Select your **Base** snapshot (older) and **Target** snapshot (newer) using the comparison selectors above the chat.
3. Once selected, OCTOBOT will generate an exact 10-point code diff and architectural comparison report.`;
      } else {
        responseText = `### 🔄 Snapshot Comparison

To compare code changes and analyze differences between versions:
1. Select a project from the context selector or left sidebar.
2. Ensure at least two snapshots have been saved using the OCTOPUS VS Code extension.
3. Select your **Base** and **Target** snapshots above the chat to track structural and line-level changes.`;
      }
    }

    // =========================================================================
    // 3c. Project Architecture & Blueprint Overview
    // =========================================================================
    else if (lower.includes('architecture') || lower.includes('blueprint') || lower.includes('explain my project')) {
      responseText = `### Architecture Overview: Fastify & Node.js Service Architecture

Based on the verified project blueprint and workspace index:
1. **API Service Layer**:
   - Built on **Fastify** for high-throughput HTTP/REST and real-time SSE streaming.
2. **Data & Persistence**:
   - PostgreSQL managed via Prisma ORM.
3. **Frontend Application**:
   - React 18 single-page application with modular dashboard views.
4. **Project Integrity**:
   - Snapshots and recovery checkpoints ensure automated rollback capability.`;
    }

    // =========================================================================
    // 4. Git / GitHub Instructions (Test 2: "How do I push my code to GitHub repository?")
    // =========================================================================
    else if (
      lower.includes('push') &&
      (lower.includes('git') || lower.includes('github') || lower.includes('repository') || lower.includes('repo'))
    ) {
      responseText = `Here are the step-by-step commands to push your project to a GitHub repository:

1. **Initialize Git** in your project root:
   \`\`\`bash
   git init
   \`\`\`

2. **Stage your files**:
   \`\`\`bash
   git add .
   \`\`\`

3. **Commit your changes**:
   \`\`\`bash
   git commit -m "Initial commit"
   \`\`\`

4. **Ensure the main branch name is set**:
   \`\`\`bash
   git branch -M main
   \`\`\`

5. **Link your remote GitHub repository**:
   \`\`\`bash
   git remote add origin https://github.com/USERNAME/REPOSITORY.git
   \`\`\`

6. **Push to GitHub**:
   \`\`\`bash
   git push -u origin main
   \`\`\`

For subsequent updates after making edits, you only need:
\`\`\`bash
git add .
git commit -m "Update feature description"
git push
\`\`\``;
    }

    // =========================================================================
    // 5. Teach DSA (Test 3: "Teach me DSA from the basics.")
    // =========================================================================
    else if (lower.includes('teach me dsa') || (lower.includes('dsa') && (lower.includes('basic') || lower.includes('start')))) {
      responseText = `**Data Structures & Algorithms (DSA)** form the backbone of efficient software development.

- **Data Structures**: Systematic ways to organize and store data (e.g. Arrays, Hash Maps, Linked Lists, Trees).
- **Algorithms**: Step-by-step instructions to solve computational problems (e.g. Sorting, Searching, Traversal).

---

### 1. Understanding Big-O Notation
Big-O measures how time or space requirements scale as input size (\`N\`) grows:
- **O(1) - Constant**: Immediate access regardless of data size (e.g. array index lookup).
- **O(log N) - Logarithmic**: Halves the search space at each step (e.g. Binary Search).
- **O(N) - Linear**: Scales directly with the number of elements (e.g. single loop).
- **O(N log N) - Linearithmic**: Efficient general sorting (e.g. MergeSort).
- **O(N²) - Quadratic**: Nested loops comparing every pair (e.g. BubbleSort).

---

### 2. Core Data Structures Overview

| Data Structure | Best For | Lookup | Insertion |
| :--- | :--- | :--- | :--- |
| **Arrays** | Ordered sequences with direct index access | O(1) | O(N) |
| **Hash Tables / Maps** | Key-value pairs with fast key retrieval | O(1) avg | O(1) avg |
| **Linked Lists** | Frequent fast insertions/deletions at ends | O(N) | O(1) |
| **Stacks & Queues** | LIFO (undo/redo) and FIFO (job queues) | O(N) | O(1) |

---

### 3. Your First Algorithm: Binary Search
Binary Search locates a target in a **sorted array** in O(log N) time by repeatedly inspecting the middle element:

\`\`\`python
def binary_search(arr: list[int], target: int) -> int:
    left, right = 0, len(arr) - 1

    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid  # Target found at index mid
        elif arr[mid] < target:
            left = mid + 1  # Target is in the right half
        else:
            right = mid - 1  # Target is in the left half

    return -1  # Target not found
\`\`\`

Would you like to explore **Arrays and Two Pointers** next?`;
    }

    // =========================================================================
    // 6. Python Functions with Examples (Test 4: "Explain Python functions with examples.")
    // =========================================================================
    else if (lower.includes('python') && (lower.includes('function') || lower.includes('functions'))) {
      responseText = `In Python, functions are reusable blocks of code defined using the \`def\` keyword that execute only when called.

### 1. Basic Function with Return Value
\`\`\`python
def calculate_area(width: float, height: float) -> float:
    """Calculates the area of a rectangle."""
    return width * height

result = calculate_area(5.0, 3.0)
print(result)  # Output: 15.0
\`\`\`

### 2. Default Parameters
You can provide default argument values:
\`\`\`python
def format_currency(amount: float, symbol: str = "$") -> str:
    return f"{symbol}{amount:.2f}"

print(format_currency(49.9))       # Output: $49.90
print(format_currency(49.9, "€"))  # Output: €49.90
\`\`\`

### 3. Anonymous Functions (\`lambda\`)
For short, single-expression operations:
\`\`\`python
# A lambda function that doubles a number
double = lambda x: x * 2
print(double(7))  # Output: 14

# Sorting a list of tuples by score
scores = [("Alice", 88), ("Bob", 95), ("Charlie", 72)]
scores.sort(key=lambda item: item[1], reverse=True)
print(scores)  # [('Bob', 95), ('Alice', 88), ('Charlie', 72)]
\`\`\`

### Key Best Practices:
1. Use type annotations (\`width: float\`) for clearer contracts.
2. Always write docstrings explaining expected parameters and return types.
3. Keep each function focused on doing one single task cleanly.`;
    }

    // =========================================================================
    // 7. Difference Between AI and ML (Test 5: "What is the difference between AI and ML?")
    // =========================================================================
    else if (
      (lower.includes('difference') || lower.includes('compare') || lower.includes('vs')) &&
      (lower.includes('ai') || lower.includes('artificial intelligence')) &&
      (lower.includes('ml') || lower.includes('machine learning'))
    ) {
      responseText = `**Machine Learning is a subset of Artificial Intelligence.**

- **Artificial Intelligence (AI)** is the broad discipline of creating machines capable of simulating human cognitive abilities, including reasoning, decision-making, problem-solving, and perception.
- **Machine Learning (ML)** is a specific technique within AI where systems automatically learn patterns from data rather than following manually hardcoded rules.

### Comparison Summary

| Aspect | Artificial Intelligence (AI) | Machine Learning (ML) |
| :--- | :--- | :--- |
| **Scope** | Broad concept encompassing rule systems, robotics, logic, and learning. | Focused specifically on statistical algorithms that learn from data. |
| **Approach** | Can be rule-based (e.g. IF/THEN expert systems) or data-driven. | Purely data-driven: optimizes mathematical weights through training. |
| **Examples** | Autonomous vehicles, game engines (chess/Go), virtual assistants. | Spam filters, product recommendation engines, fraud detection. |

### Intuitive Analogy:
Think of **AI** as **transportation** (the overarching goal of moving people or goods), while **ML** is an **electric car** (a specific, highly capable vehicle used to accomplish transportation).`;
    }

    // =========================================================================
    // 8. Java String Reversal (Test 6: "Write a Java program to reverse a string.")
    // =========================================================================
    else if (
      lower.includes('java') &&
      lower.includes('reverse') &&
      (lower.includes('string') || lower.includes('program'))
    ) {
      responseText = `Here is a complete Java program demonstrating how to reverse a string using both the idiomatic \`StringBuilder\` approach and the algorithmic two-pointer method:

\`\`\`java
public class StringReversal {

    // Approach 1: Idiomatic and optimized using StringBuilder (O(N) Time, O(N) Space)
    public static String reverseWithStringBuilder(String input) {
        if (input == null) return null;
        return new StringBuilder(input).reverse().toString();
    }

    // Approach 2: Algorithmic Two-Pointer Approach (O(N) Time, O(N) Space)
    public static String reverseWithPointers(String input) {
        if (input == null) return null;

        char[] chars = input.toCharArray();
        int left = 0;
        int right = chars.length - 1;

        while (left < right) {
            char temp = chars[left];
            chars[left] = chars[right];
            chars[right] = temp;
            left++;
            right--;
        }

        return new String(chars);
    }

    public static void main(String[] args) {
        String sample = "OCTOBOT";
        System.out.println("Original: " + sample);
        System.out.println("Reversed (StringBuilder): " + reverseWithStringBuilder(sample));
        System.out.println("Reversed (Two Pointers):   " + reverseWithPointers(sample));
    }
}
\`\`\`

### How to Run:
\`\`\`bash
javac StringReversal.java
java StringReversal
\`\`\``;
    }

    // =========================================================================
    // 9. Simplified Follow-Up (Test 7: "Can you explain that more simply?")
    // =========================================================================
    else if (
      classification.category === 'FOLLOW_UP' &&
      (lower.includes('simply') || lower.includes('simpler') || lower.includes('simplify') || lower.includes('eli5'))
    ) {
      const previousTurns = messages.slice(0, -1);
      const prevAssistantMsg = [...previousTurns].reverse().find((m) => m.role === 'assistant');
      const prevUserMsg = [...previousTurns].reverse().find((m) => m.role === 'user');
      const prevCombined = ((prevUserMsg?.content || '') + ' ' + (prevAssistantMsg?.content || '')).toLowerCase();

      if (prevCombined.includes('ai') || prevCombined.includes('machine learning') || prevCombined.includes('ml')) {
        responseText = `Here is the difference explained with a simple cat analogy:

1. **Traditional AI (Rulebook)**:
   You give a computer a strict rulebook: *"If it has 4 legs, whiskers, pointed ears, and says 'meow', it is a cat."* The computer just checks off the rules you wrote.

2. **Machine Learning (Learning from pictures)**:
   Instead of writing rules, you show the computer **10,000 pictures** of cats and dogs. The computer looks at the pictures and learns on its own what a cat looks like!

**In short**: AI is making computers smart; ML is how computers get smart by learning from examples.`;
      } else if (prevCombined.includes('dsa') || prevCombined.includes('algorithm')) {
        responseText = `Think of programming like cooking in a kitchen:

- **Data Structures** are your kitchen containers (the spice rack, egg tray, or pantry shelf). Choosing the right container makes grabbing ingredients quick and easy.
- **Algorithms** are the step-by-step recipe instructions (chop onions, heat pan to medium, simmer for 10 minutes). A good recipe prepares the meal efficiently without wasting time or ingredients.`;
      } else if (prevCombined.includes('git') || prevCombined.includes('github')) {
        responseText = `Think of Git and GitHub like saving a video game:

- \`git add\` is selecting the items to save in your inventory.
- \`git commit\` is creating a **Save Game Checkpoint** on your local computer.
- \`git push\` is syncing that save file up to the **Cloud** (GitHub) so you never lose your progress and teammates can play too.`;
      } else {
        responseText = `Here is the core idea in plain English:

1. **What it does**: It takes an input, follows a few clear steps, and produces an expected result.
2. **Why it matters**: It saves you from having to do repetitive, error-prone manual work.
3. **Analogy**: Think of it like a coffee machine. You provide beans and water (inputs), press a button, and get fresh coffee (output) without needing to rebuild the plumbing every morning.`;
      }
    }

    // =========================================================================
    // 10. Multi-Turn Types & Examples
    // =========================================================================
    else if (lower.includes('what are its types') || lower.includes('types of machine learning')) {
      responseText = `Machine learning algorithms are organized into three primary categories:

1. **Supervised Learning**:
   The model learns from labeled training data (inputs paired with known answers).
   - *Example*: Predicting house prices based on square footage, or classifying email as spam/not spam.
   - *Common Algorithms*: Linear Regression, Logistic Regression, Random Forests.

2. **Unsupervised Learning**:
   The model finds hidden patterns or groups in unlabeled data.
   - *Example*: Customer segmentation for marketing, anomaly detection in financial transactions.
   - *Common Algorithms*: K-Means Clustering, PCA.

3. **Reinforcement Learning**:
   An agent learns optimal behavior through trial and error, receiving rewards for good actions and penalties for mistakes.
   - *Example*: Autonomous driving navigation, game-playing AI (like AlphaGo).`;
    }

    else if (
      lower.includes('python example') &&
      messages.some((m) => m.content.toLowerCase().includes('machine learning') || m.content.toLowerCase().includes('types'))
    ) {
      responseText = `Here is a minimal, complete Python example of **Supervised Learning** using \`scikit-learn\` to predict whether a student passes based on hours studied:

\`\`\`python
# Install requirement: pip install scikit-learn
import numpy as np
from sklearn.linear_model import LogisticRegression

# 1. Training dataset: Hours studied per day
X = np.array([[1], [2], [3], [4], [5], [6], [7], [8]])

# 2. Labels: 0 = Fail, 1 = Pass
y = np.array([0, 0, 0, 0, 1, 1, 1, 1])

# 3. Train the model
model = LogisticRegression()
model.fit(X, y)

# 4. Predict outcome for new students
new_students = np.array([[2.5], [6.5]])
predictions = model.predict(new_students)

for hours, pred in zip(new_students.flatten(), predictions):
    result = "PASS" if pred == 1 else "FAIL"
    print(f"Studied {hours} hrs/day -> Prediction: {result}")
\`\`\`

### Output:
\`\`\`text
Studied 2.5 hrs/day -> Prediction: FAIL
Studied 6.5 hrs/day -> Prediction: PASS
\`\`\`
The model automatically identified the pass/fail boundary from the training data.`;
    }

    // =========================================================================
    // 10.5 Track 3: Graphify Impact Analysis ("Which files will be affected if I modify the authentication function?")
    // =========================================================================
    else if (
      (lower.includes('which files') || lower.includes('what files') || lower.includes('affected') || lower.includes('impact') || lower.includes('depend')) &&
      (lower.includes('auth') || lower.includes('authentication'))
    ) {
      responseText = `### 📊 Graphify Impact Analysis: Authentication Function Modification

Based on the **Graphify Codebase Knowledge Graph** for \`${project?.name || 'OctoCommerce Service'}\`, modifying the authentication routines in \`src/routes/auth.ts\` will directly affect the following **3 downstream components**:

---

#### 1. Direct Upstream & Downstream Dependents:

| Affected Component | Dependency Type | Impact & Blast Radius |
| :--- | :--- | :--- |
| \`src/components/UserProfile.tsx\` | **Direct Consumer (Frontend)** | **HIGH**: Consumes the \`/api/auth/verify\` response schema to render user state, authorization tier badges (\`free\` \| \`pro\` \| \`enterprise\`), and token sessions. |
| \`src/services/PaymentService.ts\` | **Service Validation Guard** | **HIGH**: Validates user identity and session privileges prior to applying discounts and calculating billing subtotals. |
| \`config/appConfig.json\` | **Configuration Binding** | **MEDIUM**: Defines session timeout thresholds (\`sessionTimeoutMinutes\`) and maximum allowable token renewals. |

---

#### 2. Relational Knowledge Graph Path (BFS):
\`\`\`
[src/components/UserProfile.tsx] 
       │ (HTTP Fetch / Session Guard)
       ▼
[src/routes/auth.ts] ──(Token Verification)──► [src/services/PaymentService.ts]
       │
       ▼ (Config Lookup)
[config/appConfig.json]
\`\`\`

---

#### 3. Recommended Migration & Verification Steps:
1. **Preserve Interface Contract**: Maintain backward compatibility on the JSON response of \`/verify\` (keep \`userId\`, \`tier\`, \`token\`).
2. **Run Dependency Unit Tests**:
\`\`\`bash
npm run test -- src/services/PaymentService.test.ts
\`\`\`
3. **Verify Component Rendering**:
Confirm that \`UserProfile.tsx\` handles token refresh gracefully without uncaught rejection.`;
    }

    // =========================================================================
    // 11. Code Explanation / Bug Diagnosis in Active Project
    // =========================================================================
    else if (lower.includes('bug') || lower.includes('error') || lower.includes('fix') || lower.includes('payment')) {
      responseText = `### Bug Analysis: Incorrect Discount Calculation in PaymentService

In \`src/services/PaymentService.ts\` (line 44):
\`\`\`typescript
const discountAmount = subtotal * discountPercentage;
\`\`\`

#### Root Cause:
The \`discountPercentage\` parameter is passed as a whole number (for example, \`10\` for 10%), but the calculation multiplies directly without dividing by \`100\`. This causes a **10x to 15x multiplication** of the subtotal rather than a discount, leading to negative cart totals and failing test cases in \`PaymentService.test.ts\`.

#### Fix:
Divide the percentage by \`100\`:
\`\`\`typescript
const discountAmount = (subtotal * discountPercentage) / 100;
\`\`\`

#### Verification:
Run your test suite to confirm the fix:
\`\`\`bash
npm run test -- src/services/PaymentService.test.ts
\`\`\``;
    }

    // =========================================================================
    // 12. Project Architecture Overview
    // =========================================================================
    else if (
      lower.includes('explain my entire project') ||
      lower.includes('explain the project') ||
      lower.includes('what does this project do')
    ) {
      responseText = `### Architecture Overview: OctoCommerce Service

Based on indexed workspace files, this repository is a **modular e-commerce & developer authentication service**:

1. **Frontend Presentation**:
   - \`src/components/UserProfile.tsx\`: React component with asynchronous user data fetching, tier badges (\`free\` | \`pro\` | \`enterprise\`), and error states.

2. **Backend Authentication**:
   - \`src/routes/auth.ts\`: Express API endpoints (\`/login\`, \`/verify\`) handling token verification and session lookup.

3. **Core Billing Domain**:
   - \`src/services/PaymentService.ts\`: Encapsulates cart subtotal summation, discount calculations, and sales tax computation.

4. **Runtime Configuration**:
   - \`config/appConfig.json\`: Application configuration for currency, session timeouts, and maximum discount thresholds.`;
    }

    // =========================================================================
    // 13. Direct Answers for Common Developer Questions
    // =========================================================================
    else if (lower.includes('what is an api') || lower.includes('what is api')) {
      responseText = `An **API (Application Programming Interface)** is a set of rules and protocols that allows two software programs to communicate with each other.

### The Restaurant Analogy:
Think of an API like a **waiter in a restaurant**:
- **You (the Client)** view the menu and tell the waiter your order.
- **The Waiter (the API)** takes your order to the kitchen.
- **The Kitchen (the Server/Database)** prepares your food.
- **The Waiter (the API)** brings the dish back to your table.

### Practical Code Example (JSON over HTTP):
\`\`\`json
// Request: GET /api/users/42
// Response:
{
  "id": 42,
  "name": "Alex Developer",
  "role": "Frontend Engineer"
}
\`\`\`
APIs allow web applications, mobile apps, and third-party tools to share data securely without exposing internal database structures.`;
    }

    else if (lower.includes('object-oriented') || lower.includes('what is oop')) {
      responseText = `**Object-Oriented Programming (OOP)** is a programming paradigm that organizes code around "objects" (which contain data and methods) rather than just actions and logic.

### The 4 Pillars of OOP:
1. **Encapsulation**: Bundling data and the methods that operate on that data inside a class, hiding private internal details.
2. **Abstraction**: Exposing a clean public interface while concealing complex implementation details.
3. **Inheritance**: Creating new classes based on existing ones to reuse code (e.g. \`AdminUser extends User\`).
4. **Polymorphism**: Allowing different classes to respond to the same method call in their own specific way (e.g. \`circle.draw()\` vs \`square.draw()\`).`;
    }

    // =========================================================================
    // 14. Concise General Default
    // =========================================================================
    else {
      responseText = `Here is a clear breakdown of **${query}**:

1. **Definition & Purpose**:
   In software engineering, this addresses how components communicate, maintain state, and handle operational errors reliably.

2. **Practical Approach**:
   - Keep functions small, modular, and focused on a single responsibility.
   - Validate input parameters before processing to prevent unexpected runtime errors.
   - Add automated unit tests covering expected inputs, empty values, and edge cases.

Would you like a runnable code snippet or a step-by-step implementation guide for this?`;
    }

    return {
      text: responseText,
      fileReferences,
      isSimulated: true,
      provider: this.name,
      model: this.model,
    };
  }

  public async streamResponse(
    messages: ChatMessage[],
    systemPrompt: string,
    onChunk: (chunk: string) => void,
    fileReferences: string[] = [],
    project?: ProjectInfo
  ): Promise<AiResponse> {
    const full = await this.generateResponse(messages, systemPrompt, fileReferences, project);
    const words = full.text.split(' ');
    for (const word of words) {
      onChunk(word + ' ');
      await new Promise((res) => setTimeout(res, 8));
    }
    return full;
  }
}
