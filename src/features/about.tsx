import React from "react";

const About: React.FC = () => {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16">
      <section className="grid gap-6 text-center">
        <h1 className="text-4xl font-semibold md:text-5xl">About Dev Tools</h1>
        <p className="mx-auto max-w-2xl text-balance text-lg text-muted-foreground">
          Why I built this collection of browser-based utilities.
        </p>
      </section>

      <section className="prose prose-neutral dark:prose-invert mx-auto w-full max-w-none">
        <p>
          As a developer, I often found myself searching for simple tools to
          perform quick tasks—formatting JSON, converting images, checking color
          contrast, or optimizing SVGs. While there are many online tools
          available, I was often frustrated by:
        </p>
        <ul>
          <li>
            <strong>Privacy concerns:</strong> Unsure if my data was being
            uploaded to a server.
          </li>
          <li>
            <strong>Cluttered interfaces:</strong> Ads, popups, and unnecessary
            distractions.
          </li>
          <li>
            <strong>Inconsistency:</strong> Having to bookmark a dozen different
            sites for different tasks.
          </li>
        </ul>
        <p>
          I created <strong>Dev Tools</strong> to solve these problems. It is a
          privacy-first, browser-based toolkit where everything runs locally on
          your device. No data is ever uploaded to a server. It's designed to be
          fast, clean, and reliable—a single place for the utilities I use every
          day.
        </p>
        <p>
          This project is open source and built with modern web technologies. I
          hope you find it as useful as I do.
        </p>
      </section>
    </div>
  );
};

export default About;
