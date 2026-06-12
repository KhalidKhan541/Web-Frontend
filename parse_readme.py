import re
import json

def parse_readme():
    input_file = r'c:\Webs\AI Agents Market\README.md'
    output_file = r'c:\Webs\AI Agents Market\apis-data.js'
    
    apis = []
    current_category = "Other"
    
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            
            # Category Header
            if line.startswith('### '):
                current_category = line[4:].strip()
                continue
            
            # API Entry Table Row
            if line.startswith('|') and '[' in line and '](' in line:
                # Skip table header lines
                if 'API | Description' in line or '|:---' in line or '|---' in line:
                    continue
                
                parts = [p.strip() for p in line.split('|')]
                # Parts mapping:
                # parts[0] is empty (before first |)
                # parts[1] is [Name](Link)
                # parts[2] is Description
                # parts[3] is Auth
                # parts[4] is HTTPS
                # parts[5] is CORS (sometimes omitted or blank)
                if len(parts) >= 5:
                    api_link_part = parts[1]
                    description = parts[2]
                    auth = parts[3].replace('`', '') if len(parts) > 3 else 'No'
                    https = parts[4] if len(parts) > 4 else 'Yes'
                    cors = parts[5].replace('`', '') if len(parts) > 5 else 'Unknown'
                    
                    # Regex to extract Name and URL from markdown link [Name](URL)
                    match = re.search(r'\[(.*?)\]\((.*?)\)', api_link_part)
                    if match:
                        name = match.group(1)
                        url = match.group(2)
                        
                        # Determine pricing tier and cost per call dynamically
                        # Free Tier: No Auth, CORS Yes
                        # Standard Tier: apiKey, CORS Yes/No
                        # Pro Tier: OAuth or other Auth systems
                        auth_lower = auth.lower()
                        if auth_lower == 'no' or auth_lower == 'none' or not auth_lower:
                            tier = 'Free'
                            price = 0.00
                        elif 'apikey' in auth_lower or 'api key' in auth_lower:
                            tier = 'Standard'
                            price = 0.05
                        else:
                            tier = 'Pro'
                            price = 0.20
                            
                        apis.append({
                            "name": name,
                            "category": current_category,
                            "description": description,
                            "url": url,
                            "auth": auth,
                            "https": https,
                            "cors": cors,
                            "tier": tier,
                            "price_per_call": price,
                            "is_active": True
                        })
                        
    # Write as a javascript file defining a global constant
    js_content = f"// Automatically generated from README.md\nconst APIS_DATA = {json.dumps(apis, indent=2)};\n"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print(f"Successfully parsed {len(apis)} APIs and saved to {output_file}")

if __name__ == "__main__":
    parse_readme()
