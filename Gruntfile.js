module.exports = (grunt) => {

  grunt.initConfig({

    responsive_images: {
      dev: {
        options: {
          engine: 'im',
          sizes: [{
            name: 'large_1x',
            width: 1600,
            quality: 15
          },{
            name: 'large_2x',
            width: 1600,
            quality: 30,
          },{
            name: 'medium_1x',
            width: 800,
            height: 400,
            quality: 15,
          },{
            name: 'medium_2x',
            width: 800,
            height: 400,
            quality: 30,
          },{
            name: 'small_1x',
            width: 320,
            height: 240,
            quality: 15,
          },{
            name: 'small_2x',
            width: 320,
            height: 240,
            quality: 30,
          }]
        },

        files: [{
          expand: true,
          src: ['*.jpg'],
          cwd: 'img_src/',
          dest: 'img/'
        }]
      }
    },
    
    clean: {
      dev: {
        src: ['img'],
      },
    },

    mkdir: {
      dev: {
        options: {
          create: ['img']
        },
      },
    },
  })

  grunt.loadNpmTasks('grunt-responsive-images');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-mkdir');
  grunt.registerTask('default', ['clean', 'mkdir', 'responsive_images'])
}