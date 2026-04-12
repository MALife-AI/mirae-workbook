#!/usr/bin/env node
// exchange-rate-mcp.js
// 워크숍 데모용 환율 MCP 서버.
//
// 데이터 출처: https://open.er-api.com/  (완전 무료, 인증 없음, 무제한)
// 노출 도구:
//   - get_exchange_rates(base?)            특정 기준 통화의 주요 환율을 반환
//   - convert_currency(amount, from, to)   금액을 다른 통화로 환산
//
// 실행: node exchange-rate-mcp.js   (Claude Code가 stdio 로 연결)

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = "https://open.er-api.com/v6/latest";
// 주요 통화만 노출 — 200개 다 주면 컨텍스트 낭비
const FEATURED_CURRENCIES = [
  "USD", "KRW", "EUR", "JPY", "CNY", "GBP",
  "AUD", "CAD", "CHF", "HKD", "SGD", "TWD",
];

async function fetchRates(base) {
  const code = String(base || "USD").toUpperCase();
  const res = await fetch(`${API_BASE}/${code}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.result !== "success") {
    throw new Error(data["error-type"] || "API returned error");
  }
  return data;
}

const server = new Server(
  { name: "exchange-rate", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_exchange_rates",
      description:
        "특정 기준 통화에 대한 주요 환율을 가져옵니다. " +
        "출처는 open.er-api.com 의 실시간 무료 API입니다. " +
        "사용자가 환율·외화·환전 관련 질문을 하면 반드시 이 도구를 사용하세요.",
      inputSchema: {
        type: "object",
        properties: {
          base: {
            type: "string",
            description:
              "기준 통화의 ISO 4217 코드 (예: USD, KRW, EUR, JPY, CNY). 기본값 USD",
            default: "USD",
          },
        },
      },
    },
    {
      name: "convert_currency",
      description:
        "한 통화에서 다른 통화로 금액을 환산합니다. 실시간 환율을 사용. " +
        "사용자가 '얼마야', '환산해줘', '바꾸면' 같은 표현을 쓰면 이 도구를 사용하세요.",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "number", description: "환산할 금액" },
          from: { type: "string", description: "원본 통화 ISO 4217 코드 (예: USD)" },
          to: { type: "string", description: "대상 통화 ISO 4217 코드 (예: KRW)" },
        },
        required: ["amount", "from", "to"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    if (name === "get_exchange_rates") {
      const base = String(args?.base || "USD").toUpperCase();
      const data = await fetchRates(base);
      const allRates = data.rates || {};
      const featured = {};
      for (const code of FEATURED_CURRENCIES) {
        if (code !== base && allRates[code] !== undefined) {
          featured[code] = allRates[code];
        }
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                base,
                updated_utc: data.time_last_update_utc,
                next_update_utc: data.time_next_update_utc,
                provider: data.provider,
                featured_rates: featured,
                note: `1 ${base} = (각 값) (대상 통화)`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "convert_currency") {
      const amount = Number(args?.amount);
      const from = String(args?.from || "").toUpperCase();
      const to = String(args?.to || "").toUpperCase();
      if (!Number.isFinite(amount)) throw new Error("amount must be a number");
      if (!from || !to) throw new Error("from and to are required");

      const data = await fetchRates(from);
      const rate = data.rates?.[to];
      if (rate === undefined) throw new Error(`알 수 없는 통화 코드: ${to}`);
      const converted = amount * rate;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                input: { amount, currency: from },
                output: { amount: Number(converted.toFixed(4)), currency: to },
                rate,
                updated_utc: data.time_last_update_utc,
                provider: data.provider,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (e) {
    return {
      content: [{ type: "text", text: `Error: ${e.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
