# OPAL Orchestration Layer for Provider WhatsApp Onboarding

## System Design Document

### 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPAL Orchestration Layer                       │
│              (Provider WhatsApp Starter Messages)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Provider   │──▶ │   OPAL      │──▶ │  WhatsApp    │       │
│  │   Profile    │    │ Orchestrator │    │  API         │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                           ╲      ╱                               │
│                            ▼    ▼                                │
│              ┌─────────────────────────────┐                      │
│              │   Workflow Engine            │                      │
│              │   (Chained Prompts + Tools)  │                      │
│              └─────────────────────────────┘                      │
│                           ╲      ╱                               │
│                            ▼    ▼                                │
│         ┌───────────────┐  ┌───────────────┐                     │
│         │ Gemini Model  │  │ Provider Data │                     │
│         │ Context       │  │ Cache         │                     │
│         └───────────────┘  └───────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Core Components

#### OPAL Orchestrator Class
```python
import asyncio
import json
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from enum import Enum
from abc import ABC, abstractmethod

# Enums for workflow nodes
class NodeOperation(Enum):
    PROMPT = "prompt"
    TOOL_CALL = "tool_call"
    CONDITIONAL = "conditional"
    DELAY = "delay"
    TERMINATE = "terminate"

# Context Management for Workflow
class OPALContext:
    def __init__(self, initial_data: Optional[Dict] = None):
        self.data = initial_data or {}
        self.history: List[Dict] = []
        self.session_id = f"sess_{int(datetime.now().timestamp())}"

    def update(self, key: str, value: Any):
        self.data[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        return self.data.get(key, default)

# Base node interface (for visual builder)
class OPALNode(ABC):
    def __init__(self, id: str, operation: NodeOperation):
        self.id = id
        self.operation = operation
        self.next_node: Optional[str] = None
    
    @abstractmethod
    async def execute(self, context: OPALContext) -> Optional[str]:
        """Executes the node logic and returns the ID of the next node to run."""
        pass

# Prompt Node - Chained AI prompts with Gemini Logic
class PromptNode(OPALNode):
    def __init__(self, id: str, system_prompt: str, model_type: str = "gemini-1.5-flash"):
        super().__init__(id, NodeOperation.PROMPT)
        self.system_prompt = system_prompt
        self.model_type = model_type
        
    async def execute(self, context: OPALContext) -> Optional[str]:
        user_input = context.get("last_input", "")
        # In a real scenario, call the Gemini API here
        # For now, simulate the AI output based on context
        print(f"🕊️ [OPAL:{self.id}] Running LLM ({self.model_type})...")
        
        # Mock logic: Extract intent
        ai_response = f"Processed: {user_input} with prompt: {self.system_prompt[:30]}..."
        context.update(f"output_{self.id}", ai_response)
        context.history.append({"node": self.id, "output": ai_response})
        
        return self.next_node

# Tool Call Node - External services integration
class ToolCallNode(OPALNode):
    def __init__(self, id: str, tool_name: str, endpoint: str, method: str = "GET"):
        super().__init__(id, NodeOperation.TOOL_CALL)
        self.tool_name = tool_name
        self.endpoint = endpoint
        self.method = method
    
    async def execute(self, context: OPALContext) -> Optional[str]:
        import httpx
        print(f"🛠️ [OPAL:{self.id}] Calling Tool: {self.tool_name} -> {self.endpoint}")
        
        payload = context.get(f"{self.id}_payload", {})
        
        try:
            async with httpx.AsyncClient() as client:
                if self.method.upper() == "GET":
                    response = await client.get(self.endpoint, params=payload)
                else:
                    response = await client.post(self.endpoint, json=payload)
                
                res_data = response.json()
                context.update(f"result_{self.id}", res_data)
                return self.next_node
        except Exception as e:
            print(f"❌ [TOOL ERROR] {self.id}: {e}")
            return "error_node"

# Conditional Node - Branching logic
class ConditionalNode(OPALNode):
    def __init__(self, id: str, condition_key: str, branches: Dict[Any, str]):
        super().__init__(id, NodeOperation.CONDITIONAL)
        self.condition_key = condition_key
        self.branches = branches # Value -> NextNodeID
        
    async def execute(self, context: OPALContext) -> Optional[str]:
        value = context.get(self.condition_key)
        next_node = self.branches.get(value, self.branches.get("default"))
        print(f"🔀 [OPAL:{self.id}] Branching on {self.condition_key}={value} -> {next_node}")
        return next_node

# Master Engine to run the Graph
class OPALOrchestrator:
    def __init__(self, nodes: List[OPALNode]):
        self.nodes = {n.id: n for n in nodes}
        
    async def run_workflow(self, start_id: str, initial_context: Dict[str, Any]) -> OPALContext:
        ctx = OPALContext(initial_context)
        current_id = start_id
        
        while current_id and current_id in self.nodes:
            node = self.nodes[current_id]
            current_id = await node.execute(ctx)
            
        print("🏁 [OPAL] Workflow Completed.")
        return ctx

# Example Usage (Better way to use this system)
async def example_main():
    # 1. Define Nodes
    p1 = PromptNode("intent_check", "Identify if this is a search or a registration request.")
    p1.next_node = "branch_logic"
    
    branch = ConditionalNode("branch_logic", "intent", {
        "search": "search_providers",
        "register": "onboarding_flow",
        "default": "intent_check"
    })
    
    # 2. Wire up orchestrator
    orchestrator = OPALOrchestrator([p1, branch])
    
    # 3. Execute
    final_ctx = await orchestrator.run_workflow("intent_check", {"last_input": "I want to find a plumber in Riyadh"})
    return final_ctx

if __name__ == "__main__":
    asyncio.run(example_main())