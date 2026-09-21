// Conteúdo legal do OutVitar — Termos de Uso e Política de Privacidade.
//
// ⚠️ MINUTA sujeita a validação jurídica. Redigida com base em práticas de
// mercado para apps sociais/outdoor com marketplace e conteúdo gerado por
// usuários, alinhada à LGPD (Brasil). NÃO constitui aconselhamento jurídico.
//
// A versão de cada documento é a sua data de vigência (ISO). Ao mudar o texto
// de forma relevante, atualize a versão correspondente E o LEGAL_DOC_VERSION
// para forçar o re-aceite dos usuários.
//
// Placeholders a completar pelo operador quando houver empresa constituída:
//   [RAZÃO SOCIAL], [CNPJ], [ENDEREÇO]. O contato do titular já usa
//   outvitar@gmail.com.

export const TERMS_VERSION = "2026-09-15";
export const PRIVACY_VERSION = "2026-09-15";
/** Versão do "pacote" legal usada no gate de aceite. */
export const LEGAL_DOC_VERSION = "2026-09-15";

export const CONTROLLER_EMAIL = "outvitar@gmail.com";
export const MIN_AGE = 13;

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = {
  title: string;
  version: string;
  updatedLabel: string;
  disclaimer: string;
  sections: LegalSection[];
};

type Locale = "pt-BR" | "en";

// ---------------------------------------------------------------------------
// TERMOS DE USO
// ---------------------------------------------------------------------------

const TERMS_PT: LegalDoc = {
  title: "Termos de Uso",
  version: TERMS_VERSION,
  updatedLabel: "Vigência",
  disclaimer:
    "Este documento é uma minuta sujeita a revisão jurídica. Ao usar o OutVitar, você concorda com os termos abaixo.",
  sections: [
    {
      heading: "1. Aceitação e elegibilidade",
      body: [
        "Ao criar uma conta ou usar o aplicativo OutVitar (\"App\"), você declara ter lido e concordado com estes Termos de Uso e com a Política de Privacidade.",
        `Você deve ter no mínimo ${MIN_AGE} anos para usar o App. Menores de 18 anos devem usar o App sob supervisão e responsabilidade de seus pais ou responsáveis legais.`,
        "Se você não concorda com estes Termos, não use o App.",
      ],
    },
    {
      heading: "2. Conta e segurança",
      body: [
        "Você é responsável por manter a confidencialidade de suas credenciais e por todas as atividades realizadas em sua conta.",
        "Você concorda em fornecer informações verdadeiras e mantê-las atualizadas. Podemos suspender ou encerrar contas com informações falsas ou uso indevido.",
      ],
    },
    {
      heading: "3. Uso do App e conduta",
      body: [
        "O OutVitar é uma plataforma para registrar atividades ao ar livre (com uso de GPS/localização), interagir em comunidade e acessar um marketplace de parceiros.",
        "Você concorda em não: (a) publicar conteúdo ilegal, ofensivo, difamatório, discriminatório ou que viole direitos de terceiros; (b) assediar outros usuários; (c) usar o App para fins fraudulentos; (d) tentar burlar mecanismos de segurança; (e) coletar dados de outros usuários sem consentimento.",
        "Atividades ao ar livre envolvem riscos. Você é o único responsável por sua segurança, condicionamento físico e pelas decisões tomadas durante suas atividades. O App é uma ferramenta de registro e não substitui julgamento próprio, equipamentos adequados ou orientação profissional.",
      ],
    },
    {
      heading: "4. Conteúdo gerado por você",
      body: [
        "Você mantém a titularidade do conteúdo que publica (fotos, vídeos, trajetos, textos, comentários). Ao publicar, você concede ao OutVitar uma licença mundial, não exclusiva e gratuita para hospedar, exibir e distribuir esse conteúdo dentro do App, com a finalidade de operá-lo.",
        "Você é o único responsável pelo conteúdo que publica e declara ter os direitos necessários para publicá-lo.",
        "Podemos remover conteúdo que viole estes Termos ou a lei, a nosso critério, e não temos obrigação de monitorar todo o conteúdo publicado.",
      ],
    },
    {
      heading: "5. Marketplace e parceiros",
      body: [
        "O App pode exibir parceiros (guias, pousadas, fotógrafos, lojas e outros) e permitir contato entre usuários e parceiros.",
        "O OutVitar atua apenas como plataforma de conexão. Não somos parte de negociações, contratos, pagamentos ou serviços realizados entre usuários e parceiros, e não nos responsabilizamos por sua qualidade, execução, cancelamento ou eventuais prejuízos.",
        "A verificação de parceiros (por exemplo, selo Cadastur) indica apenas que documentos foram apresentados, e não constitui garantia sobre os serviços prestados.",
      ],
    },
    {
      heading: "6. Lojas virtuais e pagamentos",
      body: [
        "O App poderá oferecer lojas virtuais e formas de pagamento operadas por nós ou por terceiros.",
        "Não nos responsabilizamos pelo uso que você faz de lojas virtuais de terceiros nem por transações realizadas fora do nosso controle, ressalvadas as obrigações que a lei nos impuser.",
        "Quando houver venda direta operada pelo OutVitar, as condições específicas (preço, entrega, reembolso) serão informadas no momento da compra.",
      ],
    },
    {
      heading: "7. Propriedade intelectual",
      body: [
        "O App, sua marca, design, código e demais elementos são de titularidade do OutVitar ou de seus licenciadores e são protegidos por lei. Você não adquire direitos sobre eles pelo simples uso do App.",
      ],
    },
    {
      heading: "8. Isenção de garantias",
      body: [
        "O App é fornecido \"no estado em que se encontra\". Não garantimos que ele estará sempre disponível, livre de erros ou que os dados de GPS/localização serão precisos.",
      ],
    },
    {
      heading: "9. Limitação de responsabilidade",
      body: [
        "Na máxima extensão permitida pela lei, o OutVitar não se responsabiliza por danos indiretos, lucros cessantes, perda de dados ou danos decorrentes de atividades realizadas pelo usuário, de conteúdo de terceiros ou de negociações no marketplace.",
      ],
    },
    {
      heading: "10. Indenização",
      body: [
        "Você concorda em indenizar o OutVitar por reclamações de terceiros decorrentes do seu uso do App, do conteúdo que publicar ou da violação destes Termos.",
      ],
    },
    {
      heading: "11. Suspensão e encerramento",
      body: [
        "Podemos suspender ou encerrar sua conta em caso de violação destes Termos. Você pode encerrar sua conta a qualquer momento pela opção de exclusão de conta no App.",
      ],
    },
    {
      heading: "12. Alterações dos Termos",
      body: [
        "Podemos atualizar estes Termos. Quando houver mudança relevante, solicitaremos novo aceite no App. O uso continuado após a atualização significa concordância.",
      ],
    },
    {
      heading: "13. Lei aplicável e foro",
      body: [
        "Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro do domicílio do usuário para dirimir controvérsias, salvo disposição legal em contrário.",
        "Contato: [RAZÃO SOCIAL] — [CNPJ] — [ENDEREÇO] — " + CONTROLLER_EMAIL + ".",
      ],
    },
  ],
};

const TERMS_EN: LegalDoc = {
  title: "Terms of Use",
  version: TERMS_VERSION,
  updatedLabel: "Effective date",
  disclaimer:
    "This document is a draft subject to legal review. By using OutVitar, you agree to the terms below.",
  sections: [
    {
      heading: "1. Acceptance and eligibility",
      body: [
        'By creating an account or using the OutVitar app ("App"), you confirm you have read and agree to these Terms of Use and the Privacy Policy.',
        `You must be at least ${MIN_AGE} years old to use the App. Users under 18 must use it under the supervision and responsibility of a parent or legal guardian.`,
        "If you do not agree with these Terms, do not use the App.",
      ],
    },
    {
      heading: "2. Account and security",
      body: [
        "You are responsible for keeping your credentials confidential and for all activity under your account.",
        "You agree to provide accurate information and keep it up to date. We may suspend or terminate accounts with false information or misuse.",
      ],
    },
    {
      heading: "3. Use of the App and conduct",
      body: [
        "OutVitar is a platform to record outdoor activities (using GPS/location), interact in a community and access a partner marketplace.",
        "You agree not to: (a) post illegal, offensive, defamatory or discriminatory content or content that infringes third-party rights; (b) harass other users; (c) use the App for fraudulent purposes; (d) attempt to bypass security; (e) collect other users' data without consent.",
        "Outdoor activities involve risks. You are solely responsible for your safety, fitness and decisions during your activities. The App is a recording tool and does not replace your own judgment, proper equipment or professional guidance.",
      ],
    },
    {
      heading: "4. Your content",
      body: [
        "You retain ownership of the content you post (photos, videos, routes, text, comments). By posting, you grant OutVitar a worldwide, non-exclusive, royalty-free license to host, display and distribute that content within the App to operate it.",
        "You are solely responsible for the content you post and confirm you have the rights to post it.",
        "We may remove content that violates these Terms or the law, at our discretion, and we are not obligated to monitor all content.",
      ],
    },
    {
      heading: "5. Marketplace and partners",
      body: [
        "The App may display partners (guides, lodges, photographers, shops and others) and allow contact between users and partners.",
        "OutVitar acts only as a connection platform. We are not a party to negotiations, contracts, payments or services between users and partners, and we are not liable for their quality, performance, cancellation or any losses.",
        "Partner verification (e.g., Cadastur badge) only indicates that documents were submitted and is not a guarantee of the services provided.",
      ],
    },
    {
      heading: "6. Virtual stores and payments",
      body: [
        "The App may offer virtual stores and payment methods operated by us or by third parties.",
        "We are not liable for your use of third-party virtual stores or for transactions outside our control, except as required by law.",
        "When there is a direct sale operated by OutVitar, the specific conditions (price, delivery, refund) will be shown at purchase time.",
      ],
    },
    {
      heading: "7. Intellectual property",
      body: [
        "The App, its brand, design, code and other elements belong to OutVitar or its licensors and are protected by law. Using the App does not grant you rights over them.",
      ],
    },
    {
      heading: "8. Disclaimer of warranties",
      body: [
        'The App is provided "as is". We do not guarantee it will always be available, error-free, or that GPS/location data will be accurate.',
      ],
    },
    {
      heading: "9. Limitation of liability",
      body: [
        "To the maximum extent permitted by law, OutVitar is not liable for indirect damages, lost profits, data loss or damages arising from user activities, third-party content or marketplace negotiations.",
      ],
    },
    {
      heading: "10. Indemnification",
      body: [
        "You agree to indemnify OutVitar against third-party claims arising from your use of the App, the content you post or your violation of these Terms.",
      ],
    },
    {
      heading: "11. Suspension and termination",
      body: [
        "We may suspend or terminate your account for violations of these Terms. You may terminate your account at any time via the account deletion option in the App.",
      ],
    },
    {
      heading: "12. Changes to the Terms",
      body: [
        "We may update these Terms. When there is a material change, we will request a new acceptance in the App. Continued use after the update means agreement.",
      ],
    },
    {
      heading: "13. Governing law and venue",
      body: [
        "These Terms are governed by the laws of Brazil. The user's domicile venue is elected to settle disputes, unless the law provides otherwise.",
        "Contact: [LEGAL ENTITY] — [TAX ID] — [ADDRESS] — " + CONTROLLER_EMAIL + ".",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// POLÍTICA DE PRIVACIDADE
// ---------------------------------------------------------------------------

const PRIVACY_PT: LegalDoc = {
  title: "Política de Privacidade",
  version: PRIVACY_VERSION,
  updatedLabel: "Vigência",
  disclaimer:
    "Esta política descreve como tratamos seus dados pessoais no OutVitar. É uma minuta sujeita a revisão jurídica.",
  sections: [
    {
      heading: "1. Controlador dos dados",
      body: [
        "O tratamento de dados pessoais no OutVitar é realizado por [RAZÃO SOCIAL], inscrita no CNPJ [CNPJ], com sede em [ENDEREÇO].",
        "Canal de contato sobre privacidade (encarregado/DPO): " + CONTROLLER_EMAIL + ".",
      ],
    },
    {
      heading: "2. Dados que coletamos",
      body: [
        "Dados de cadastro: nome, nome de usuário, e-mail, foto de perfil e, quando informados, telefone, documento (CPF/CNPJ) e endereço.",
        "Dados de localização/GPS: coletados durante o registro de atividades (trajeto, velocidade, elevação) e, se você autorizar, para recursos ao vivo. A coleta em segundo plano ocorre apenas quando você inicia uma atividade.",
        "Conteúdo que você publica: atividades, posts, fotos, vídeos, comentários, mensagens diretas.",
        "Dados de uso e dispositivo: interações no App, identificadores de dispositivo e tokens de notificação push.",
      ],
    },
    {
      heading: "3. Bases legais e finalidades (LGPD)",
      body: [
        "Execução do serviço e do contrato: criar e operar sua conta, registrar atividades, exibir a comunidade e o marketplace.",
        "Consentimento: compartilhamento de localização ao vivo, envio de notificações push.",
        "Legítimo interesse: segurança, prevenção a fraude, melhoria do App.",
        "Cumprimento de obrigação legal: quando aplicável.",
      ],
    },
    {
      heading: "4. Compartilhamento de dados",
      body: [
        "Provedores de infraestrutura: usamos o Supabase (banco de dados, autenticação e armazenamento) para operar o App.",
        "Serviços de mapa e localização, provedores de notificação push e outros processadores estritamente necessários à operação.",
        "Parceiros do marketplace: apenas dados que você optar por compartilhar ao entrar em contato com um parceiro.",
        "Não vendemos seus dados pessoais.",
      ],
    },
    {
      heading: "5. Seus direitos",
      body: [
        "Você pode solicitar: acesso, correção, exclusão, anonimização, portabilidade dos dados e revogação de consentimento.",
        "Você pode excluir sua conta a qualquer momento pela opção de exclusão de conta no App. Para outras solicitações, contate " + CONTROLLER_EMAIL + ".",
      ],
    },
    {
      heading: "6. Retenção e exclusão de dados",
      body: [
        "Mantemos seus dados enquanto sua conta estiver ativa.",
        "Ao excluir sua conta, os dados de identificação (nome, e-mail, foto, contatos, endereço) e o conteúdo pessoal são removidos, e o expurgo completo em cópias de segurança ocorre em até 30 dias.",
        "Conteúdo de curadoria compartilhada (por exemplo, destinos aprovados) pode ser mantido de forma anonimizada, sem vínculo com sua identidade.",
        "Quando houver obrigação legal de guarda (por exemplo, registros de transações financeiras), reteremos apenas o mínimo necessário pelo prazo exigido por lei, de forma segregada.",
      ],
    },
    {
      heading: "7. Segurança",
      body: [
        "Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo controle de acesso e criptografia em trânsito. Nenhum sistema é 100% seguro; em caso de incidente relevante, adotaremos as providências legais.",
      ],
    },
    {
      heading: "8. Transferência internacional",
      body: [
        "Alguns provedores podem processar dados fora do Brasil. Nesses casos, buscamos garantir proteção adequada conforme a LGPD.",
      ],
    },
    {
      heading: "9. Dados de menores",
      body: [
        `O App destina-se a maiores de ${MIN_AGE} anos. Não coletamos intencionalmente dados de crianças abaixo dessa idade. Menores de 18 devem usar o App sob responsabilidade dos pais ou responsáveis.`,
      ],
    },
    {
      heading: "10. Identificadores e notificações",
      body: [
        "Usamos identificadores de dispositivo e tokens de notificação para enviar alertas do App. Você pode desativar notificações nas configurações do dispositivo.",
      ],
    },
    {
      heading: "11. Alterações desta política",
      body: [
        "Podemos atualizar esta política. Quando houver mudança relevante, solicitaremos novo aceite no App e indicaremos a nova data de vigência.",
      ],
    },
  ],
};

const PRIVACY_EN: LegalDoc = {
  title: "Privacy Policy",
  version: PRIVACY_VERSION,
  updatedLabel: "Effective date",
  disclaimer:
    "This policy describes how we handle your personal data in OutVitar. It is a draft subject to legal review.",
  sections: [
    {
      heading: "1. Data controller",
      body: [
        "Personal data processing in OutVitar is carried out by [LEGAL ENTITY], tax ID [TAX ID], headquartered at [ADDRESS].",
        "Privacy contact (DPO): " + CONTROLLER_EMAIL + ".",
      ],
    },
    {
      heading: "2. Data we collect",
      body: [
        "Account data: name, username, email, profile photo and, when provided, phone, tax document and address.",
        "Location/GPS data: collected while recording activities (route, speed, elevation) and, if you allow, for live features. Background collection happens only when you start an activity.",
        "Content you post: activities, posts, photos, videos, comments, direct messages.",
        "Usage and device data: in-app interactions, device identifiers and push notification tokens.",
      ],
    },
    {
      heading: "3. Legal bases and purposes",
      body: [
        "Service and contract performance: create and operate your account, record activities, display the community and the marketplace.",
        "Consent: live location sharing, sending push notifications.",
        "Legitimate interest: security, fraud prevention, improving the App.",
        "Legal obligation: where applicable.",
      ],
    },
    {
      heading: "4. Data sharing",
      body: [
        "Infrastructure providers: we use Supabase (database, authentication and storage) to operate the App.",
        "Map and location services, push notification providers and other processors strictly necessary to operate the App.",
        "Marketplace partners: only data you choose to share when contacting a partner.",
        "We do not sell your personal data.",
      ],
    },
    {
      heading: "5. Your rights",
      body: [
        "You may request access, correction, deletion, anonymization, data portability and withdrawal of consent.",
        "You can delete your account at any time via the account deletion option in the App. For other requests, contact " + CONTROLLER_EMAIL + ".",
      ],
    },
    {
      heading: "6. Data retention and deletion",
      body: [
        "We keep your data while your account is active.",
        "When you delete your account, identifying data (name, email, photo, contacts, address) and personal content are removed, and full purge from backups occurs within 30 days.",
        "Shared curated content (e.g., approved destinations) may be kept anonymized, with no link to your identity.",
        "Where there is a legal retention obligation (e.g., financial transaction records), we keep only the minimum required by law, segregated.",
      ],
    },
    {
      heading: "7. Security",
      body: [
        "We adopt technical and organizational measures to protect your data, including access control and encryption in transit. No system is 100% secure; in case of a relevant incident, we will take the legal measures.",
      ],
    },
    {
      heading: "8. International transfer",
      body: [
        "Some providers may process data outside Brazil. In such cases, we seek adequate protection under the applicable law.",
      ],
    },
    {
      heading: "9. Minors' data",
      body: [
        `The App is intended for users aged ${MIN_AGE}+. We do not knowingly collect data from children below that age. Users under 18 must use the App under parental responsibility.`,
      ],
    },
    {
      heading: "10. Identifiers and notifications",
      body: [
        "We use device identifiers and notification tokens to send App alerts. You can disable notifications in your device settings.",
      ],
    },
    {
      heading: "11. Changes to this policy",
      body: [
        "We may update this policy. When there is a material change, we will request a new acceptance in the App and show the new effective date.",
      ],
    },
  ],
};

export function getTermsDoc(locale: string): LegalDoc {
  return normalizeLocale(locale) === "en" ? TERMS_EN : TERMS_PT;
}

export function getPrivacyDoc(locale: string): LegalDoc {
  return normalizeLocale(locale) === "en" ? PRIVACY_EN : PRIVACY_PT;
}

function normalizeLocale(locale: string): Locale {
  return locale?.toLowerCase().startsWith("en") ? "en" : "pt-BR";
}

// Exportado para os testes de paridade.
export const _docs = { TERMS_PT, TERMS_EN, PRIVACY_PT, PRIVACY_EN };
