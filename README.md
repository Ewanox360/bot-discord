# bot-discord

Instructions rapides pour démarrer le bot

1. Installer les dépendances :

```bash
npm install
```

2. Créer un fichier `.env` à la racine (ou exporter les variables d'environnement) en copiant `.env.example` :

```bash
copy .env.example .env
# puis éditez .env et remplacez your_bot_token_here par votre vrai token
```

3. Lancer le bot :

```bash
npm start
```

Notes de sécurité

- Ne commitez jamais votre fichier `.env` contenant le token.
- Ajoutez `.env` à votre `.gitignore` si ce n'est pas déjà fait.

Railway

- Dans Railway, ouvrez votre projet, allez dans "Variables d'environnement" et créez `TOKEN` avec la valeur du token de votre bot.
- (Optionnel) Ajoutez `PREFIX` si vous voulez surcharger le préfixe par défaut.
- Le `start` command est déjà défini (`npm start`), Railway utilisera ces variables d'environnement automatiquement.

Assurez-vous que le token est bien configuré dans Railway avant de déployer; ne le stockez jamais dans le dépôt.
