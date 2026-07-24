import asyncio
import os
import re
import subprocess
from dotenv import load_dotenv
from chaingpt.client import ChainGPTClient
from chaingpt.models.smart_contract import SmartContractGeneratorRequestModel
from chaingpt.types import ChatHistoryMode

# --- CONFIG ---
load_dotenv()
CHAINGPT_API_KEY = os.getenv("CHAINGPT_API_KEY")

# Generated contracts land in their own directory. contracts/GenContract.sol is a
# fixture the Hardhat test suite deploys, so writing there would break the tests.
CONTRACTS_DIR = "./contracts/generated"
CONTRACT_FILENAME = "GeneratedContract.sol"

# Must match a network defined in hardhat.config.cjs.
DEPLOY_NETWORK = "monadTestnet"
DEPLOY_SCRIPT = "scripts/deploy.cjs"


def clean_code_block(text):
    # Strips markdown code blocks
    pattern = r"```solidity(.*?)```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.replace("```", "").strip()


async def main():
    if not CHAINGPT_API_KEY:
        print("❌ Error: Missing CHAINGPT_API_KEY in .env.local or the environment.")
        return

    client = ChainGPTClient(api_key=CHAINGPT_API_KEY)

    try:
        print("\n🏗️  MONAD ARCHITECT AGENT (Next.js + Hardhat)")
        print("--------------------------------------------")
        prompt = input(">> What contract do you want? (e.g. 'A token named PizzaCoin'): ")

        # 1. GENERATE
        print("\n🧠 Generating Smart Contract code...")
        request = SmartContractGeneratorRequestModel(
            question=(
                f"{prompt}. Name the contract 'GeneratedContract'. "
                "Target the Monad network. Ensure Solidity ^0.8.20."
            ),
            chatHistory=ChatHistoryMode.OFF,
        )

        try:
            resp = await client.smart_contract.generate_contract(request)
        except Exception as e:
            print(f"❌ API Error: {e}")
            return

        if not resp.status:
            print(f"❌ ChainGPT Error: {resp.message}")
            return

        code = clean_code_block(resp.data.bot)
        if not code:
            print("❌ Generator returned no code.")
            return

        # 2. SAVE TO FILE
        os.makedirs(CONTRACTS_DIR, exist_ok=True)
        file_path = os.path.join(CONTRACTS_DIR, CONTRACT_FILENAME)

        with open(file_path, "w") as f:
            f.write(code)

        print(f"✅ Code saved to: {file_path}")
        print("\n--- PREVIEW ---")
        print(code[:200] + "...\n")

        # 3. DEPLOY
        confirm = input(f">> Deploy to Monad Testnet now? (y/n): ")
        if confirm.lower() == "y":
            if not os.getenv("PRIVATE_KEY"):
                print("❌ Cannot deploy: set PRIVATE_KEY in .env.local first.")
                return

            print("\n🚀 Triggering Hardhat Deployment...")
            try:
                subprocess.run(
                    ["npx", "hardhat", "run", DEPLOY_SCRIPT, "--network", DEPLOY_NETWORK],
                    check=True,
                )
            except subprocess.CalledProcessError as e:
                print(f"❌ Deployment Failed: {e}")
        else:
            print("Creating contract only. Done.")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
