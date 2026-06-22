// Languages offered by the in-interview code compiler. `id` is sent to the run
// endpoint and must match a Piston language name or alias; `monaco` is the
// Monaco editor language id; `starter` is the default snippet. Versions are
// resolved server-side from the live Piston runtimes list, so they aren't pinned
// here (they can drift without breaking the dropdown).

export type CodeLanguage = {
  id: string;
  label: string;
  monaco: string;
  starter: string;
};

export const CODE_LANGUAGES: CodeLanguage[] = [
  {
    id: "python",
    label: "Python 3",
    monaco: "python",
    starter: `# Write your solution here\ndef solution():\n    return "Hello, World!"\n\nprint(solution())\n`,
  },
  {
    id: "javascript",
    label: "JavaScript (Node)",
    monaco: "javascript",
    starter: `// Write your solution here\nfunction solution() {\n  return "Hello, World!";\n}\n\nconsole.log(solution());\n`,
  },
  {
    id: "typescript",
    label: "TypeScript",
    monaco: "typescript",
    starter: `// Write your solution here\nfunction solution(): string {\n  return "Hello, World!";\n}\n\nconsole.log(solution());\n`,
  },
  {
    id: "java",
    label: "Java",
    monaco: "java",
    starter: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`,
  },
  {
    id: "c",
    label: "C",
    monaco: "c",
    starter: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n`,
  },
  {
    id: "c++",
    label: "C++",
    monaco: "cpp",
    starter: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n`,
  },
  {
    id: "csharp",
    label: "C#",
    monaco: "csharp",
    starter: `using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}\n`,
  },
  {
    id: "go",
    label: "Go",
    monaco: "go",
    starter: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n`,
  },
  {
    id: "rust",
    label: "Rust",
    monaco: "rust",
    starter: `fn main() {\n    println!("Hello, World!");\n}\n`,
  },
  {
    id: "ruby",
    label: "Ruby",
    monaco: "ruby",
    starter: `# Write your solution here\nputs "Hello, World!"\n`,
  },
  {
    id: "php",
    label: "PHP",
    monaco: "php",
    starter: `<?php\necho "Hello, World!\\n";\n`,
  },
  {
    id: "kotlin",
    label: "Kotlin",
    monaco: "kotlin",
    starter: `fun main() {\n    println("Hello, World!")\n}\n`,
  },
  {
    id: "swift",
    label: "Swift",
    monaco: "swift",
    starter: `print("Hello, World!")\n`,
  },
  {
    id: "bash",
    label: "Bash",
    monaco: "shell",
    starter: `echo "Hello, World!"\n`,
  },
];

export const DEFAULT_LANGUAGE_ID = "python";

export function getCodeLanguage(id: string): CodeLanguage {
  return CODE_LANGUAGES.find((l) => l.id === id) || CODE_LANGUAGES[0];
}
