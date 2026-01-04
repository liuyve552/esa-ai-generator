type QwenMessage = { role: "system" | "user" | "assistant"; content: string };

type DashScopeResponse = {
  output?: {
    text?: string;
    choices?: Array<{
      message?: { role?: string; content?: string };
      text?: string;
    }>;
  };
  message?: string;
  code?: string;
};

export async function generateWithQwen({
  apiKey,
  model,
  messages
}: {
  apiKey: string;
  model: string;
  messages: QwenMessage[];
}): Promise<{ text: string; model: string }> {
  const res = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: { messages },
        parameters: {
          temperature: 0.8,
          top_p: 0.9,
          result_format: "message"
        }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`DashScope error: ${res.status} ${err}`);
  }

  const json = (await res.json().catch(() => null)) as DashScopeResponse | null;
  const choiceText =
    json?.output?.choices?.[0]?.message?.content ?? json?.output?.choices?.[0]?.text ?? json?.output?.text ?? null;
  if (!choiceText || typeof choiceText !== "string") {
    throw new Error(`DashScope invalid response: ${json?.code ?? ""} ${json?.message ?? ""}`.trim());
  }
  return { text: choiceText.trim(), model };
}

