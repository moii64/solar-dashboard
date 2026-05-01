"""
Browser-use smoke test cho Solar Dashboard.
Chạy: uv run python scripts/smoke_browser.py
"""
from browser_use import Agent, Browser, ChatBrowserUse
import asyncio
import os

API_BASE = os.getenv("API_BASE", "https://solar-dashboard-rouge.vercel.app")

async def main():
    browser = Browser(use_cloud=False)  # Local, hoặc use_cloud=True cho cloud
    
    agent = Agent(
        task=f"Mở {API_BASE}, xác nhận thấy text 'SolarVN' hoặc 'Control Center'. "
             f"Kiểm tra có khu vực stats cards. Trả về JSON với keys: brand, has_stats, has_site_list.",
        llm=ChatBrowserUse(),
        browser=browser,
    )
    result = await agent.run()
    print("\n=== RESULT ===")
    print(result)
    await browser.close()

if __name__ == "__main__":
    asyncio.run(main())