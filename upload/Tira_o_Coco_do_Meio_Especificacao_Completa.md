# TIRA O COCÓ DO MEIO
## Documento de Produto, Natureza, Jogabilidade e Especificação Funcional

**Versão:** 1.0  
**Estado:** Especificação-base para desenvolvimento  
**Idioma principal:** Português  
**Contexto:** Jogo de estratégia para 2 jogadores, inspirado na cultura angolana.

---

## 1. Visão geral

**Tira o Cocó do Meio** é um jogo de estratégia abstrata para dois jogadores. Cada jogador controla três peças de uma cor e tenta posicioná-las de forma a criar uma linha de três peças.

O jogo utiliza um tabuleiro com **9 posições**, organizadas em uma grelha 3×3. A posição central é a casa especial do jogo e dá origem ao nome **“Tira o Cocó do Meio”**.

A experiência deve ser:

- simples de aprender;
- rápida de jogar;
- competitiva;
- baseada em antecipação e bloqueio;
- fácil de jogar presencialmente ou digitalmente;
- visualmente associada à cultura angolana sem depender de estereótipos;
- suficientemente estratégica para permitir domínio através da prática.

---

# 2. Natureza do jogo

## 2.1 Género

- Jogo de estratégia abstrata.
- Jogo de tabuleiro.
- Jogo competitivo para 2 jogadores.
- Informação perfeita.
- Sem dados.
- Sem cartas aleatórias.
- Sem elementos de sorte durante a partida.

## 2.2 Jogadores

- Mínimo: 2.
- Máximo: 2.
- Não existem equipas.
- Cada jogador controla exclusivamente as suas três peças.

## 2.3 Objetivo

O objetivo é formar uma linha de **três peças da mesma cor**.

As oito linhas vencedoras são:

1. 1–2–3
2. 4–5–6
3. 7–8–9
4. 1–4–7
5. 2–5–8
6. 3–6–9
7. 1–5–9
8. 3–5–7

O primeiro jogador que completar uma dessas linhas vence imediatamente.

---

# 3. Tabuleiro

O tabuleiro possui nove posições:

```text
1 ───── 2 ───── 3
│       │       │
│       │       │
4 ───── 5 ───── 6
│       │       │
│       │       │
7 ───── 8 ───── 9
```

## 3.1 Centro

A posição **5** é o centro.

Ela possui importância estratégica especial porque participa de quatro linhas vencedoras:

- 4–5–6
- 2–5–8
- 1–5–9
- 3–5–7

O centro deve ser visualmente destacado na versão digital e física.

---

# 4. Posição inicial

A partida começa sempre com a configuração fixa:

```text
🟢  🟢  🟢
⚪  ⚪  ⚪
🔴  🔴  🔴
```

Ou, numericamente:

```text
1 = Jogador 1
2 = Jogador 1
3 = Jogador 1

4 = vazio
5 = vazio
6 = vazio

7 = Jogador 2
8 = Jogador 2
9 = Jogador 2
```

### Estado inicial

```text
P1: [1, 2, 3]
P2: [7, 8, 9]
Vazias: [4, 5, 6]
```

Não existe fase de colocação inicial. As seis peças já começam no tabuleiro.

---

# 5. Turnos

O **Jogador 1 começa sempre**.

A sequência normal é:

```text
Jogador 1
↓
Jogador 2
↓
Jogador 1
↓
Jogador 2
...
```

Cada turno permite **um único movimento de uma peça**.

---

# 6. Movimento

## 6.1 Regra principal

Uma peça pode deslocar-se para **qualquer posição disponível do tabuleiro**, desde que o movimento respeite a regra de não saltar peças.

Uma posição ocupada por uma peça adversária ou pela própria peça não pode ser usada como destino.

## 6.2 Destino

Se uma peça estiver na posição `X`, qualquer outra posição vazia pode ser destino, desde que o caminho utilizado pelo movimento não exija saltar uma peça.

Exemplo:

```text
Origem: 1
Destino: 5
```

é permitido se o caminho estiver livre.

## 6.3 Não é permitido saltar

Uma peça não pode atravessar uma peça que esteja no seu caminho.

Exemplo conceptual:

```text
🟢 ─── 🔴 ─── ⚪
```

A peça verde não pode passar pela posição ocupada pela peça vermelha para alcançar a posição vazia.

O motor do jogo deve verificar o caminho antes de aceitar um movimento.

---

# 7. Regra de ocupação

Uma casa só pode conter uma peça.

Não é permitido:

- duas peças na mesma casa;
- mover uma peça para uma casa ocupada;
- substituir uma peça adversária;
- capturar peças.

**Não existe captura.**

---

# 8. Vitória

Depois de cada movimento, o jogo deve verificar imediatamente todas as linhas vencedoras.

## Linhas vencedoras

```text
[1,2,3]
[4,5,6]
[7,8,9]

[1,4,7]
[2,5,8]
[3,6,9]

[1,5,9]
[3,5,7]
```

Se as três posições de qualquer linha pertencerem ao mesmo jogador:

```text
P1 == P1 == P1
```

ou

```text
P2 == P2 == P2
```

a partida termina.

O jogador que completou a linha é declarado vencedor.

---

# 9. Exemplo de vitória

Se o estado for:

```text
🟢  🟢  🟢
🔴  ⚪  ⚪
🔴  ⚪  🔴
```

o Jogador 1 possui:

```text
1–2–3
```

Logo:

**Jogador 1 vence.**

---

# 10. Bloqueio

Bloquear o adversário é uma parte fundamental da estratégia.

Exemplo:

```text
🔴  🔴  ⚪
```

Se a casa vazia completar uma linha vencedora, o adversário possui uma ameaça imediata.

O jogador deve considerar bloquear essa posição.

A interface digital deve, opcionalmente, destacar uma ameaça imediata do adversário em modo tutorial.

---

# 11. Ameaças múltiplas

Uma **ameaça** é uma situação em que um jogador pode completar uma linha vencedora no próximo movimento.

Uma **ameaça dupla** ocorre quando o mesmo jogador possui duas possibilidades diferentes de vitória no próximo turno.

Exemplo conceptual:

```text
Ameaça A → casa X
Ameaça B → casa Y
```

Como cada jogador só pode fazer um movimento por turno, uma ameaça dupla pode tornar impossível bloquear ambas.

O sistema de IA deve reconhecer este conceito para calcular jogadas estratégicas.

---

# 12. Empate

Como o jogo possui movimentação contínua e não há colocação de novas peças, uma partida pode entrar num ciclo de posições.

Para evitar partidas infinitas, a implementação digital deve utilizar uma regra de repetição.

## Regra recomendada

Se **a mesma posição completa do tabuleiro e o mesmo jogador a jogar** ocorrerem três vezes, a partida termina em empate.

Uma posição completa inclui:

- localização das três peças do Jogador 1;
- localização das três peças do Jogador 2;
- jogador cujo turno é o próximo.

O empate também pode ser declarado pelo sistema se existir uma sequência suficientemente longa sem alteração estratégica, conforme a configuração do modo de jogo.

---

# 13. Estado do jogo

O jogo deve ser modelado como uma máquina de estados.

## Estados principais

```text
READY
↓
PLAYER_1_TURN
↓
PLAYER_2_TURN
↓
PLAYER_1_TURN
...
↓
WIN_P1
ou
WIN_P2
ou
DRAW
```

## Estados auxiliares

- `PAUSED`
- `GAME_OVER`
- `RESTART_CONFIRMATION`

---

# 14. Modelo de dados

Uma representação simples do tabuleiro:

```json
{
  "board": [
    "P1",
    "P1",
    "P1",
    null,
    null,
    null,
    "P2",
    "P2",
    "P2"
  ],
  "currentPlayer": "P1",
  "status": "PLAYER_1_TURN",
  "winner": null,
  "moveCount": 0
}
```

As posições do array são:

```text
index 0 → casa 1
index 1 → casa 2
index 2 → casa 3
index 3 → casa 4
index 4 → casa 5
index 5 → casa 6
index 6 → casa 7
index 7 → casa 8
index 8 → casa 9
```

---

# 15. Validação de movimentos

Antes de executar um movimento, o sistema deve verificar:

1. É realmente o turno do jogador?
2. A origem contém uma peça do jogador?
3. O destino está vazio?
4. Origem e destino são posições válidas?
5. O caminho não contém uma peça que precise ser saltada?
6. O jogo ainda não terminou?

Se qualquer resposta for negativa, o movimento deve ser recusado.

---

# 16. Fluxo de um turno

```text
1. Jogador seleciona uma peça
        ↓
2. Sistema identifica a posição de origem
        ↓
3. Sistema mostra destinos permitidos
        ↓
4. Jogador seleciona destino
        ↓
5. Sistema valida movimento
        ↓
6. Movimento é executado
        ↓
7. Sistema verifica vitória
        ↓
8. Sistema verifica empate/repetição
        ↓
9. Se não terminou:
   muda o jogador
        ↓
10. Próximo turno
```

---

# 17. Interface de jogo

## 17.1 Elementos obrigatórios

A tela principal da partida deve apresentar:

- tabuleiro;
- seis peças;
- indicação visual do jogador atual;
- indicador de vitória/derrota;
- botão de reiniciar;
- botão de sair/voltar;
- contador de jogadas opcional;
- indicação visual do centro.

## 17.2 Seleção de peça

Quando o jogador tocar/clicar numa peça:

- a peça fica destacada;
- as casas válidas ficam realçadas;
- as casas inválidas permanecem neutras;
- o jogador escolhe o destino.

## 17.3 Feedback

O jogo deve fornecer feedback para:

- peça selecionada;
- movimento válido;
- movimento inválido;
- ameaça;
- vitória;
- empate;
- mudança de turno.

---

# 18. Animações

As animações devem ser rápidas e claras.

### Movimento

```text
posição inicial
      ↓
peça desloca-se
      ↓
posição final
```

### Vitória

Quando uma linha for completada:

1. destacar as três peças;
2. destacar a linha vencedora;
3. apresentar mensagem;
4. bloquear novos movimentos;
5. disponibilizar “Jogar novamente”.

---

# 19. Regras de UX

O jogador nunca deve precisar adivinhar:

- de quem é o turno;
- qual peça está selecionada;
- para onde pode mover;
- por que um movimento foi recusado;
- quem ganhou;
- por que a partida terminou.

Mensagens recomendadas:

**Turno do Jogador 1**

> “Sua vez. Escolha uma peça.”

**Destino inválido**

> “Essa casa está ocupada.”

**Movimento bloqueado**

> “Não é possível saltar uma peça.”

**Vitória**

> “Jogador 1 venceu!”

**Empate**

> “Empate! A posição repetiu-se.”

---

# 20. Modos de jogo

## 20.1 Jogador vs Jogador

Dois jogadores no mesmo dispositivo.

Configuração:

```text
P1 = humano
P2 = humano
```

## 20.2 Jogador vs Computador

Configuração:

```text
P1 = humano
P2 = IA
```

ou opcionalmente:

```text
P1 = IA
P2 = humano
```

## 20.3 Computador vs Computador

Modo de demonstração e teste.

```text
P1 = IA
P2 = IA
```

Útil para:

- testar equilíbrio;
- observar estratégias;
- validar regras;
- encontrar ciclos;
- testar a IA.

---

# 21. Inteligência artificial

A IA deve utilizar uma função de avaliação baseada em:

1. vitória imediata;
2. bloqueio de vitória imediata;
3. criação de ameaça dupla;
4. bloqueio de ameaça dupla;
5. controle do centro;
6. criação de linhas abertas;
7. mobilidade;
8. prevenção de ciclos.

## Prioridade de decisão

```text
1. Ganhar imediatamente
2. Impedir derrota imediata
3. Criar ameaça dupla
4. Impedir ameaça dupla
5. Melhorar posição
6. Controlar centro
7. Evitar repetição
```

Para níveis avançados, pode ser utilizado **Minimax com poda Alpha-Beta**.

Como o espaço de estados é pequeno, também é possível utilizar busca exaustiva/memorização.

---

# 22. Níveis de dificuldade

## Fácil

A IA:

- faz algumas jogadas aleatórias;
- reconhece vitórias imediatas;
- reconhece ameaças simples.

## Médio

A IA:

- bloqueia ameaças;
- procura ameaças duplas;
- valoriza o centro;
- utiliza profundidade de busca moderada.

## Difícil

A IA:

- utiliza Minimax;
- analisa respostas do adversário;
- detecta ciclos;
- procura a melhor sequência disponível.

## Perfeito

A IA explora o espaço de estados possível com memoização e joga de acordo com a solução calculada para a variante implementada.

---

# 23. Histórico de partidas

O sistema deve poder guardar:

```json
{
  "date": "2026-09-30",
  "player1": "Jogador 1",
  "player2": "Jogador 2",
  "result": "P1",
  "moves": [
    {"from": 2, "to": 5},
    {"from": 8, "to": 2}
  ]
}
```

O histórico pode ser usado para:

- replay;
- análise;
- estatísticas;
- depuração;
- treino da IA.

---

# 24. Replay

O replay deve permitir:

- iniciar partida;
- pausar;
- avançar uma jogada;
- voltar uma jogada;
- reiniciar replay;
- visualizar o movimento atual.

Exemplo:

```text
Jogada 0 → posição inicial
Jogada 1 → P1: 2→5
Jogada 2 → P2: 8→2
Jogada 3 → ...
```

---

# 25. Sistema de pontuação

Para uma partida simples:

```text
Vitória = 1
Derrota = 0
Empate = 0,5
```

Para um modo competitivo, o sistema pode manter:

- partidas;
- vitórias;
- derrotas;
- empates;
- sequência de vitórias.

O sistema de ranking deve ser opcional e não faz parte das regras fundamentais do jogo.

---

# 26. Tutorial

O tutorial deve ensinar:

### Passo 1
“Este é o tabuleiro.”

### Passo 2
“Você controla três peças.”

### Passo 3
“Jogador 1 começa.”

### Passo 4
“Escolha uma peça.”

### Passo 5
“Escolha uma casa livre.”

### Passo 6
“Não é permitido saltar peças.”

### Passo 7
“Forme uma linha de três.”

### Passo 8
“Bloqueie o adversário.”

### Passo 9
“O centro é uma posição estratégica.”

### Passo 10
“Quem formar três primeiro vence.”

---

# 27. Acessibilidade

A versão digital deve incluir:

- distinção por cor e forma;
- opção para daltonismo;
- textos de feedback;
- tamanhos de toque adequados;
- contraste suficiente;
- suporte a teclado quando aplicável;
- efeitos sonoros opcionais;
- possibilidade de desligar animações.

As peças não devem ser diferenciadas **somente pela cor**.

Exemplo:

```text
P1 = círculo com símbolo ▲
P2 = círculo com símbolo ●
```

---

# 28. Som

O som deve ser discreto e reforçar a experiência.

Eventos:

- seleção de peça;
- movimento;
- erro;
- ameaça;
- vitória;
- empate;
- início de partida.

A música não deve dificultar a concentração.

---

# 29. Identidade cultural

O jogo deve ser apresentado como uma experiência de origem/inspiração angolana.

A identidade visual pode utilizar:

- geometria inspirada no tabuleiro;
- padrões gráficos contemporâneos;
- referências cromáticas angolanas;
- elementos visuais associados à cultura angolana de forma respeitosa.

Evitar transformar a cultura em decoração genérica.

O objetivo é que a marca pareça **angolana e contemporânea**, e não uma representação estereotipada de África.

---

# 30. Ecrã inicial

Estrutura recomendada:

```text
        TIRA
     O COCÓ DO
        MEIO

       [JOGAR]

     [COMO JOGAR]

      [OPÇÕES]

      [SOBRE]
```

---

# 31. Ecrã de seleção

```text
MODO DE JOGO

[ 2 JOGADORES ]

[ CONTRA COMPUTADOR ]

[ COMPUTADOR VS COMPUTADOR ]
```

---

# 32. Ecrã da partida

```text
JOGADOR 1 — SUA VEZ

      🟢 ─── 🟢 ─── 🟢
       │      │      │
       │      │      │
      ⚪ ─── ⚪ ─── ⚪
       │      │      │
       │      │      │
      🔴 ─── 🔴 ─── 🔴

        [REINICIAR]
```

---

# 33. Ecrã de vitória

```text
       VITÓRIA!

    JOGADOR 1

  🟢 ─── 🟢 ─── 🟢

     [JOGAR NOVAMENTE]

          [SAIR]
```

---

# 34. Regras resumidas para o jogador

> **Tira o Cocó do Meio**
>
> Dois jogadores, três peças cada.
>
> O Jogador 1 começa.
>
> Em cada turno, mova uma das suas peças para uma casa livre.
>
> Não pode saltar uma peça durante o movimento.
>
> Forme uma linha de três peças para vencer.
>
> Bloqueie o adversário antes que ele faça o mesmo.
>
> O centro é uma posição estratégica importante.
>
> Não existem capturas.
>
> A partida termina quando houver vencedor ou empate por repetição.

---

# 35. Critérios de aceitação

A implementação é considerada funcional quando:

- [ ] o tabuleiro possui exatamente 9 casas;
- [ ] existem exatamente 3 peças por jogador;
- [ ] a configuração inicial é fixa;
- [ ] Jogador 1 começa;
- [ ] uma peça pode escolher qualquer destino permitido;
- [ ] casas ocupadas não podem ser destino;
- [ ] saltos são impedidos;
- [ ] não existe captura;
- [ ] todas as 8 linhas vencedoras são verificadas;
- [ ] a vitória termina imediatamente a partida;
- [ ] o empate por repetição é detectado;
- [ ] o turno alterna corretamente;
- [ ] movimentos inválidos são rejeitados;
- [ ] o jogador sabe sempre de quem é o turno;
- [ ] o jogo pode ser reiniciado;
- [ ] PvP funciona;
- [ ] PvE funciona, quando ativado;
- [ ] a IA respeita todas as regras do motor;
- [ ] replay, se implementado, reproduz exatamente os movimentos;
- [ ] não é possível continuar a jogar depois do fim da partida.

---

# 36. Arquitetura recomendada

Separar o projeto em quatro camadas:

```text
GAME ENGINE
    ↓
RULES / VALIDATION
    ↓
UI / PRESENTATION
    ↓
AUDIO / ANIMATION
```

## Game Engine

Responsável por:

- estado;
- turnos;
- movimentos;
- vitória;
- empate;
- histórico.

## Rules

Responsável por:

- validar movimentos;
- calcular linhas;
- calcular caminhos;
- detectar ameaças;
- detectar repetição.

## UI

Responsável por:

- tabuleiro;
- peças;
- seleção;
- mensagens;
- menus.

## IA

Responsável por:

- escolher movimentos;
- avaliar posições;
- pesquisar árvores de jogo.

A IA nunca deve implementar regras próprias. Ela deve usar o mesmo motor de regras utilizado pelos jogadores humanos.

---

# 37. Regra fundamental de engenharia

**Uma única fonte de verdade para as regras.**

A função de validação deve ser compartilhada por:

- jogador humano;
- IA;
- replay;
- tutorial;
- testes.

Assim evita-se que, por exemplo, a interface permita uma jogada que a IA considera ilegal.

---

# 38. Testes obrigatórios

Criar testes para:

### Inicialização

```text
P1 = [1,2,3]
P2 = [7,8,9]
turn = P1
```

### Vitória horizontal

Testar:

```text
1-2-3
4-5-6
7-8-9
```

### Vitória vertical

Testar:

```text
1-4-7
2-5-8
3-6-9
```

### Vitória diagonal

Testar:

```text
1-5-9
3-5-7
```

### Ocupação

Confirmar que:

```text
destino ocupado = movimento inválido
```

### Salto

Confirmar que:

```text
caminho bloqueado = movimento inválido
```

### Turno

Confirmar:

```text
P1 → P2 → P1 → P2
```

### Fim de jogo

Confirmar que nenhum movimento ocorre depois de:

```text
WIN_P1
WIN_P2
DRAW
```

### Repetição

Confirmar que a mesma posição + mesmo jogador em turno é detectada.

---

# 39. Princípio de design da experiência

O jogo deve parecer simples nos primeiros segundos, mas revelar profundidade conforme o jogador aprende.

A experiência ideal:

```text
ENTENDER
   ↓
JOGAR
   ↓
BLOQUEAR
   ↓
ANTECIPAR
   ↓
CRIAR AMEAÇAS
   ↓
DOMINAR
```

O jogador deve conseguir começar uma partida quase imediatamente, sem precisar ler um manual extenso.

---

# 40. Resumo definitivo das regras

| Regra | Definição |
|---|---|
| Jogadores | 2 |
| Peças | 3 por jogador |
| Tabuleiro | 3×3 / 9 posições |
| Posição inicial | P1 em 1,2,3; P2 em 7,8,9 |
| Centro | Casa 5 |
| Primeiro jogador | Jogador 1 |
| Colocação inicial | Não existe |
| Movimento | Uma peça por turno |
| Destino | Qualquer casa livre permitida |
| Salto | Não permitido |
| Captura | Não existe |
| Vitória | 3 peças em linha |
| Linhas | 8 |
| Centro em linhas | 4 |
| Empate | Repetição da posição |
| Informação oculta | Nenhuma |
| Sorte | Nenhuma |

---

# 41. Nota sobre a especificação

Esta documentação consolida as regras fornecidas para esta versão específica de **Tira o Cocó do Meio**.

A referência pública do jogo confirma o conceito de jogo angolano, o alinhamento de três peças, a importância das diagonais/centro e o caráter de bloqueio estratégico. As regras detalhadas de movimento usadas neste documento — especialmente **Jogador 1 começa, qualquer destino permitido e proibição de saltar peças** — foram incorporadas a partir das regras fornecidas para esta versão durante a definição do produto.

Consequentemente, esta documentação deve ser tratada como a **especificação funcional da versão que será desenvolvida**, e não como uma transcrição literal de um regulamento histórico publicado.

---

# 42. Identidade do produto

**Nome:** Tira o Cocó do Meio  
**Categoria:** Jogo de estratégia  
**Jogadores:** 2  
**Origem/inspiração:** Angola  
**Peças:** 3 vs 3  
**Tabuleiro:** 9 posições  
**Elemento central:** posição 5  
**Objetivo:** alinhar três  
**Duração:** curta, variável conforme os movimentos  
**Aleatoriedade:** nenhuma  
**Competição:** estratégia e antecipação

> **Tira o Cocó do Meio — simples de começar, difícil de dominar.**
