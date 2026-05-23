"""
Interactive OAuth2 helper to obtain YouTube refresh tokens for each channel.

Run this locally (not in CI) to generate refresh tokens, then add them to
GitHub Secrets as YOUTUBE_REFRESH_TOKEN_CH1 through YOUTUBE_REFRESH_TOKEN_CH5.

Usage:
    python scripts/get_youtube_token.py
"""

import json
import os
import webbrowser
from pathlib import Path

from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

CHANNELS = {
    "ch1": "DOPAMINE LOOP",
    "ch2": "FINANCEFICTION",
    "ch3": "REDACTED",
    "ch4": "THE GREY MATTER",
    "ch5": "THE QUIET RECORD",
}


def get_token_for_channel(channel_id: str, channel_name: str, client_secret_path: str) -> str:
    """Run OAuth flow for a single channel and return the refresh token."""
    print(f"\n{'='*60}")
    print(f"Authenticating channel: {channel_name} ({channel_id.upper()})")
    print(f"{'='*60}")
    print(
        "\nA browser window will open. Sign in with the Google account"
        f" that owns the '{channel_name}' YouTube channel.\n"
    )

    flow = InstalledAppFlow.from_client_secrets_file(
        client_secret_path,
        scopes=SCOPES,
        redirect_uri="urn:ietf:wg:oauth:2.0:oob",
    )

    # Use local server flow for easier token capture
    credentials = flow.run_local_server(port=0, open_browser=True)

    refresh_token = credentials.refresh_token
    if not refresh_token:
        raise ValueError(f"No refresh token received for {channel_name}. Ensure 'access_type=offline' is set.")

    print(f"\n✅ Refresh token obtained for {channel_name}:")
    print(f"   YOUTUBE_REFRESH_TOKEN_{channel_id.upper()}={refresh_token}")

    return refresh_token


def main():
    print("YouTube OAuth Token Generator")
    print("=" * 60)
    print(
        "\nThis script generates OAuth refresh tokens for all 5 channels.\n"
        "Prerequisites:\n"
        "  1. Google Cloud project with YouTube Data API v3 enabled\n"
        "  2. OAuth 2.0 Desktop App credentials downloaded as client_secret.json\n"
        "  3. Run this on your local machine (not in CI)\n"
    )

    # Find client_secret.json
    secret_path = os.environ.get("YOUTUBE_CLIENT_SECRET_PATH", "client_secret.json")
    if not Path(secret_path).exists():
        print(f"ERROR: client_secret.json not found at: {secret_path}")
        print("Download it from: https://console.cloud.google.com/apis/credentials")
        return

    tokens = {}
    for channel_id, channel_name in CHANNELS.items():
        try:
            token = get_token_for_channel(channel_id, channel_name, secret_path)
            tokens[channel_id] = token
        except KeyboardInterrupt:
            print("\nAborted by user.")
            break
        except Exception as exc:
            print(f"\nERROR for {channel_name}: {exc}")
            continue

    print("\n" + "=" * 60)
    print("GITHUB SECRETS — add these to your repository:")
    print("  Settings → Secrets and variables → Actions → New repository secret")
    print("=" * 60 + "\n")

    # Also print shared credentials
    client_id = os.environ.get("YOUTUBE_CLIENT_ID", "<your-client-id>")
    client_secret = os.environ.get("YOUTUBE_CLIENT_SECRET", "<your-client-secret>")
    print(f"YOUTUBE_CLIENT_ID={client_id}")
    print(f"YOUTUBE_CLIENT_SECRET={client_secret}")

    for channel_id, token in tokens.items():
        print(f"YOUTUBE_REFRESH_TOKEN_{channel_id.upper()}={token}")

    # Save to local file for reference
    output = {
        "YOUTUBE_CLIENT_ID": client_id,
        "YOUTUBE_CLIENT_SECRET": client_secret,
    }
    for channel_id, token in tokens.items():
        output[f"YOUTUBE_REFRESH_TOKEN_{channel_id.upper()}"] = token

    tokens_file = "youtube_tokens.json"
    with open(tokens_file, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n✅ Tokens also saved to: {tokens_file}")
    print("   ⚠️  Add youtube_tokens.json to .gitignore — never commit it!")


if __name__ == "__main__":
    main()
