def caesar_cipher(message, shift, mode='encode'):
    # Normalize shift to within alphabet bounds
    shift = shift % 26
    if mode == 'decode':
        shift = -shift

    result = ""

    for char in message:
        if char.isalpha():
            base = ord('A') if char.isupper() else ord('a')
            shifted = (ord(char) - base + shift) % 26
            result += chr(base + shifted)
        else:
            result += char  # Keep punctuation and spaces as-is

    return result
if __name__ == "__main__":
    # Example usage
    text = input("Enter message: ")
    shift_val = int(input("Enter shift value: "))
    action = input("Type 'encode' to encrypt or 'decode' to decrypt: ").strip().lower()

    output = caesar_cipher(text, shift_val, action)
    print(f"\nResult: {output}")