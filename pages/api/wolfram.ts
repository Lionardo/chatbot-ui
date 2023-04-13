import { NextApiRequest, NextApiResponse } from 'next';

import { OPENAI_API_HOST } from '@/utils/app/const';
import { cleanSourceText } from '@/utils/server/google';

import { Message } from '@/types/chat';
import { GoogleBody, GoogleSource } from '@/types/google';

import { Readability } from '@mozilla/readability';
import endent from 'endent';
import jsdom, { JSDOM } from 'jsdom';

const handler = async (req: NextApiRequest, res: NextApiResponse<any>) => {
  try {
    const { messages, key, model } = req.body as any;

    const userMessage = messages[messages.length - 1];
    const query = encodeURIComponent(userMessage.content.trim());
    // fetch mit POST request
    const wolframManifestRes = await fetch(
      'https://www.wolframalpha.com/.well-known/ai-plugin.json',
    );

    const wolframManifest = await wolframManifestRes.json();

    const actions = `${wolframManifest.name_for_model}: "${wolframManifest.description_for_model}"`;

    const answerPrompt = endent`
    Provide me with the information I requested. Use the sources to provide an accurate response. Respond in markdown format. Cite the sources you used as a markdown link as you use them at the end of each sentence by number of the source (ex: [[1]](link.com)). Provide an accurate response and then stop. Today's date is ${new Date().toLocaleDateString()}.


    Input:
    ${userMessage.content.trim()}

    Available Actions: 
    N/A: no suitable action, just perform simple GPT completion.
     - ${actions}.

    Response:
    `;

    const answerMessage: Message = { role: 'user', content: answerPrompt };

    const answerRes = await fetch(`${OPENAI_API_HOST}/v1/chat/completions`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`,
        ...(process.env.OPENAI_ORGANIZATION && {
          'OpenAI-Organization': process.env.OPENAI_ORGANIZATION,
        }),
      },
      method: 'POST',
      body: JSON.stringify({
        model: model.id,
        messages: [
          {
            role: 'system',
            content: `Use the sources to provide an accurate response. Respond in markdown format. Cite the sources you used as [1](link), etc, as you use them. Maximum 4 sentences.`,
          },
          answerMessage,
        ],
        max_tokens: 1000,
        temperature: 1,
        stream: false,
      }),
    });

    const { choices: choices2 } = await answerRes.json();

    console.log('IN SERVER \n', choices2[0].message);

    const answer = choices2[0].message.content;

    res.status(200).json({ answer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error' });
  }
};

export default handler;
