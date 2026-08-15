import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCommandString, McpClientBridge } from '../src/mcp/mcpClient.js';

// Mock the MCP SDK classes
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class MockClient {
      constructor(public clientInfo: any, public options: any) {}
      connect = vi.fn().mockResolvedValue(undefined);
      listTools = vi.fn().mockResolvedValue({
        tools: [
          {
            name: 'create_document',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                folderId: { type: 'string' }
              },
              required: ['title']
            }
          },
          {
            name: 'append_text',
            inputSchema: {
              type: 'object',
              properties: {
                documentId: { type: 'string' },
                text: { type: 'string' }
              },
              required: ['documentId', 'text']
            }
          },
          {
            name: 'create_draft',
            inputSchema: {
              type: 'object',
              properties: {
                to: { type: 'array', items: { type: 'string' } },
                subject: { type: 'string' },
                body: { type: 'string' }
              },
              required: ['to', 'subject', 'body']
            }
          }
        ]
      });
      callTool = vi.fn().mockImplementation(async (params: any) => {
        if (params.name === 'create_document') {
          return {
            content: [{ type: 'text', text: 'Created document with URL: https://docs.google.com/document/d/real-doc-id-999/edit' }]
          };
        }
        if (params.name === 'create_draft') {
          return {
            content: [{ type: 'text', text: 'Created draft: drafts/real-draft-id-888' }]
          };
        }
        return { content: [] };
      });
    }
  };
});

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  return {
    StdioClientTransport: class MockStdioTransport {
      constructor(public serverParams: any) {}
      start = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
    }
  };
});

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => {
  return {
    StreamableHTTPClientTransport: class MockStreamableHttpTransport {
      constructor(public url: URL) {}
      start = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
    }
  };
});

describe('McpClientBridge Tests', () => {
  describe('parseCommandString', () => {
    it('should correctly parse single commands', () => {
      const result = parseCommandString('npx');
      expect(result.command).toBe('npx');
      expect(result.args).toEqual([]);
    });

    it('should split command and simple arguments', () => {
      const result = parseCommandString('node dist/server.js');
      expect(result.command).toBe('node');
      expect(result.args).toEqual(['dist/server.js']);
    });

    it('should handle single-quoted arguments with spaces', () => {
      const result = parseCommandString("node 'dist folder/server.js' --debug");
      expect(result.command).toBe('node');
      expect(result.args).toEqual(['dist folder/server.js', '--debug']);
    });

    it('should handle double-quoted arguments with spaces', () => {
      const result = parseCommandString('node "dist folder/server.js" --debug');
      expect(result.command).toBe('node');
      expect(result.args).toEqual(['dist folder/server.js', '--debug']);
    });

    it('should throw an error on empty commands', () => {
      expect(() => parseCommandString('   ')).toThrow('Empty command path');
    });
  });

  describe('McpClientBridge Mock Fallback Mode', () => {
    let bridge: McpClientBridge;

    beforeEach(() => {
      bridge = new McpClientBridge();
    });

    it('should fallback to mock mode if server paths are empty strings', async () => {
      await bridge.connectToDocs('');
      await bridge.connectToGmail('');

      const docId = await bridge.createDoc('Test Doc', 'Some Content');
      const draftId = await bridge.createDraft('test@example.com', 'Subject', 'Body');

      expect(docId).toBe('mock-doc-id-123');
      expect(draftId).toBe('mock-draft-id-456');
    });
  });

  describe('McpClientBridge SDK Connection Mode', () => {
    let bridge: McpClientBridge;

    beforeEach(() => {
      bridge = new McpClientBridge();
    });

    it('should call Client connect, discover and call tools on Docs', async () => {
      await bridge.connectToDocs('node dummy-docs.js');

      const docId = await bridge.createDoc('Actual Title', 'Actual Content');
      expect(docId).toBe('real-doc-id-999');
    });

    it('should forward a folder ID to the Google Docs MCP create tool when provided', async () => {
      await bridge.connectToDocs('node dummy-docs.js');

      await bridge.createDoc('Actual Title', 'Actual Content', { folderId: 'folder-123' } as any);

      const callArgs = (bridge['docsClient'] as any).callTool.mock.calls[0][0];
      expect(callArgs.arguments).toMatchObject({ title: 'Actual Title', folderId: 'folder-123' });
    });

    it('should append to an existing Google Doc when a document URL is provided', async () => {
      await bridge.connectToDocs('node dummy-docs.js');

      const docId = await bridge.createDoc('Actual Title', 'Actual Content', {
        documentUrl: 'https://docs.google.com/document/d/target-doc-123/edit?tab=t.0'
      } as any);

      expect(docId).toBe('target-doc-123');
      const appendCall = (bridge['docsClient'] as any).callTool.mock.calls.find((call: any) => call[0].name === 'append_text');
      expect(appendCall[0].arguments).toMatchObject({ documentId: 'target-doc-123', text: 'Actual Content' });
    });

    it('should call Client connect, discover and call tools on Gmail', async () => {
      await bridge.connectToGmail('node dummy-gmail.js');

      const draftId = await bridge.createDraft('test@example.com', 'Actual Subject', 'Actual Body');
      expect(draftId).toBe('real-draft-id-888');
    });

    it('should use an HTTP transport when given a remote MCP URL', async () => {
      await bridge.connectToDocs('https://mcpserverreviewgrowapp-production.up.railway.app');

      expect(bridge['docsTransport']).toBeDefined();
      expect(bridge['docsTransport']?.constructor?.name).toBe('MockStreamableHttpTransport');
      expect(bridge['docsClient']).toBeDefined();
    });

    it('should gracefully clean up on close', async () => {
      await bridge.connectToDocs('node dummy-docs.js');
      await bridge.connectToGmail('node dummy-gmail.js');
      await expect(bridge.close()).resolves.not.toThrow();
    });
  });
});
